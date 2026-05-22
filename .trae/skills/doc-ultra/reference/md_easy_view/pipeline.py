"""流水线编排器。

协调 Stage0-5 的执行，管理中间产物，支持断点续跑。
"""

import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config import DocUltraConfig
from .agents.parser import ParserAgent
from .agents.optimizer import OptimizerAgent
from .agents.fuser import FuserAgent
from .agents.checker import CheckerAgent
from .agents.expander import ExpanderAgent
from .agents.polisher import PolisherAgent
from .providers.base import create_provider


class PipelineRunner:
    """文档超融合流水线执行器。

    按 Stage0 → Stage1 → Stage2 → Stage3 → Stage4(可选) → Stage5 顺序执行。
    中间产物保存在 .doc-ultra/ 目录中，支持断点续跑。
    """

    def __init__(self, config: DocUltraConfig, work_dir: Optional[Path] = None):
        """初始化流水线。

        Args:
            config: doc-ultra 配置
            work_dir: 工作目录（存放中间产物），默认为当前目录下的 .doc-ultra/
        """
        self.config = config
        self.work_dir = work_dir or Path.cwd() / ".doc-ultra"
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self._log: list[str] = []

    def run(
        self,
        input_file: str,
        output_path: str,
        *,
        skip_expand: bool = True,
        target_words: int = 0,
        check_only: bool = False,
    ) -> str:
        """执行完整流水线。

        Args:
            input_file: 输入文件路径
            output_path: 输出文件路径
            skip_expand: 跳过扩写阶段
            target_words: 目标字数（>0 时触发扩写）
            check_only: 仅执行检查（跳过优化和扩写）

        Returns:
            最终输出文档的路径
        """
        start_time = time.time()

        # 读取输入
        raw_input = Path(input_file).read_text(encoding="utf-8")
        attachments = self._collect_attachments(input_file)

        preset_info = f", 预设: {self.config.active_preset}" if self.config.active_preset else ""
        self._log_step("PIPELINE", f"流水线启动{preset_info}")
        self._log_step("INPUT", f"输入文件: {input_file}, 附件: {len(attachments)} 个")

        # Stage0: 需求解析
        self._log_step("STAGE0", "开始需求解析...")
        req_spec = self._run_stage0(raw_input, attachments)
        self._save_artifact("stage0-requirement-spec.md", req_spec)
        self._log_step("STAGE0", f"完成，产出 {len(req_spec)} 字符")

        if check_only:
            return self._check_only_flow(req_spec, raw_input, output_path)

        # Stage1: 多视角并行优化
        self._log_step("STAGE1", f"开始多视角并行优化 ({len(self.config.optimizers)} 个视角)...")
        drafts = self._run_stage1(req_spec, raw_input)
        for perspective_id, draft in drafts.items():
            self._save_artifact(f"stage1-draft-{perspective_id}.md", draft)
        self._log_step("STAGE1", f"完成，{len(drafts)} 份优化稿已产出")

        # Stage2: 融合合成
        self._log_step("STAGE2", "开始融合合成...")
        fused = self._run_stage2(req_spec, drafts)
        self._save_artifact("stage2-draft-fused.md", fused)
        self._log_step("STAGE2", f"完成，融合稿 {len(fused)} 字符")

        # Stage3: 拷问检查循环
        self._log_step("STAGE3", f"开始检查循环 (最多 {self.config.pipeline.max_grill_rounds} 轮)...")
        checked, reports = self._run_stage3(req_spec, fused)
        for i, report in enumerate(reports, 1):
            self._save_artifact(f"stage3-check-report-r{i}.md", report)
        self._save_artifact("stage3-draft-checked.md", checked)
        self._log_step("STAGE3", f"完成，{len(reports)} 轮检查")

        current_doc = checked

        # Stage4: 扩写（可选）
        if not skip_expand and target_words > 0:
            self._log_step("STAGE4", f"开始扩写 (目标: {target_words} 字)...")
            expanded = self._run_stage4(current_doc, target_words)
            self._save_artifact("stage4-draft-expanded.md", expanded)
            self._log_step("STAGE4", f"完成，扩写后 {len(expanded)} 字符")

            # 扩写后轻量检查
            self._log_step("STAGE3-LITE", "扩写后轻量检查...")
            current_doc, lite_reports = self._run_stage3(req_spec, expanded)
            self._log_step("STAGE3-LITE", f"完成，{len(lite_reports)} 轮")

        # Stage5: 终审抛光
        self._log_step("STAGE5", "开始终审抛光...")
        polished = self._run_stage5(current_doc)
        self._save_artifact("stage5-output.md", polished)
        self._log_step("STAGE5", f"完成，最终稿 {len(polished)} 字符")

        # 写出最终文件
        output = Path(output_path)
        output.write_text(polished, encoding="utf-8")

        elapsed = time.time() - start_time
        self._log_step("PIPELINE", f"流水线完成，总耗时 {elapsed:.1f}s，输出: {output}")

        # 写入执行日志
        self._save_artifact("pipeline-execution.log", "\n".join(self._log))

        return str(output)

    def run_check_only(self, input_file: str, output_path: str) -> str:
        """仅执行检查流程（无优化、无扩写）."""
        return self.run(
            input_file=input_file,
            output_path=output_path,
            check_only=True,
        )

    # ─── 各阶段实现 ───────────────────────────────────────

    def _run_stage0(self, raw_input: str, attachments: list[str]) -> str:
        """Stage0: 需求解析."""
        agent = ParserAgent(self.config.parser)
        # 将原始输入也作为附件之一（如果是多文件场景）
        return agent.parse(raw_requirements=raw_input, attachments=attachments or None)

    def _run_stage1(self, req_spec: str, original: str) -> dict[str, str]:
        """Stage1: 多视角并行优化."""
        agent = OptimizerAgent(self.config.optimizers)
        return agent.optimize(requirement_spec=req_spec, original_document=original)

    def _run_stage2(self, req_spec: str, drafts: dict[str, str]) -> str:
        """Stage2: 融合合成."""
        agent = FuserAgent(self.config.fuser)
        return agent.fuse(requirement_spec=req_spec, drafts=drafts)

    def _run_stage3(self, req_spec: str, document: str) -> tuple[str, list[str]]:
        """Stage3: 拷问检查循环."""
        agent = CheckerAgent(self.config.checker)

        # 尝试创建修复 Provider（复用 checker 的配置，但用更高 temperature）
        from .providers.base import ProviderConfig as PC

        fixer_config = PC(
            provider=self.config.checker.provider,
            model=self.config.checker.model,
            temperature=0.4,
            api_key=self.config.checker.api_key,
            base_url=self.config.checker.base_url,
        )
        fixer = create_provider(fixer_config)

        return agent.run_grill_loop(
            requirement_spec=req_spec,
            document=document,
            max_rounds=self.config.pipeline.max_grill_rounds,
            fixer_provider=fixer,
        )

    def _run_stage4(self, document: str, target_words: int) -> str:
        """Stage4: 扩写."""
        agent = ExpanderAgent(self.config.expander)
        return agent.expand(document=document, target_words=target_words)

    def _run_stage5(self, document: str) -> str:
        """Stage5: 终审抛光."""
        agent = PolisherAgent(self.config.polisher)
        return agent.polish(document=document)

    def _check_only_flow(self, req_spec: str, document: str, output_path: str) -> str:
        """仅检查模式."""
        checked, reports = self._run_stage3(req_spec, document)
        for i, report in enumerate(reports, 1):
            self._save_artifact(f"stage3-check-report-r{i}.md", report)
        self._save_artifact("stage3-draft-checked.md", checked)

        output = Path(output_path)
        output.write_text(checked, encoding="utf-8")
        self._log_step("CHECK-ONLY", f"检查完成，输出: {output}")
        self._save_artifact("pipeline-execution.log", "\n".join(self._log))
        return str(output)

    # ─── 工具方法 ─────────────────────────────────────────

    def _collect_attachments(self, input_file: str) -> list[str]:
        """收集输入文件所在目录的附件。

        在输入文件同目录下查找可能的附件文件（.md, .txt, .pdf 等）。
        """
        attachments: list[str] = []
        input_dir = Path(input_file).parent
        input_name = Path(input_file).name

        for ext in [".md", ".txt", ".yaml", ".yml", ".json"]:
            for file_path in input_dir.glob(f"*{ext}"):
                if file_path.name == input_name:
                    continue
                if file_path.stat().st_size > self.config.attachments.max_total_size_mb * 1024 * 1024:
                    continue
                if len(attachments) >= self.config.attachments.max_files:
                    break
                try:
                    attachments.append(file_path.read_text(encoding="utf-8"))
                except UnicodeDecodeError:
                    pass

        return attachments

    def _save_artifact(self, name: str, content: str) -> None:
        """保存中间产物."""
        path = self.work_dir / name
        # 原子写入
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(content, encoding="utf-8")
        tmp.replace(path)

    def _log_step(self, stage: str, message: str) -> None:
        """记录执行日志."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = f"[{timestamp}] [{stage}] {message}"
        self._log.append(entry)
