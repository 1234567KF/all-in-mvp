"""CLI 入口模块 v2。

支持预设选择、自动检测文档类型、Provider 能力展示。
"""

import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich.text import Text

from .config import (
    DocUltraConfig,
    CAPABILITY_LABELS,
    load_config,
    apply_preset,
    detect_document_type,
    list_presets,
)
from .pipeline import PipelineRunner
from .preview import PreviewServer

console = Console()


def print_banner() -> None:
    """打印工具 Banner."""
    console.print()
    console.print(
        Panel.fit(
            "[bold cyan]doc-ultra v2[/bold cyan] — 文档超融合处理工具\n"
            "多视角并行优化 + 串行拷问检查 + 智能预设系统",
            border_style="cyan",
        )
    )


def _cap_tags(provider_name: str, config: DocUltraConfig) -> str:
    """格式化 Provider 能力标签."""
    if provider_name in config.providers:
        caps = config.providers[provider_name].capabilities
        tags = []
        for c in caps[:4]:  # 最多显示4个
            label = CAPABILITY_LABELS.get(c, c)
            tags.append(f"[{label}]")
        return "".join(tags)
    return ""


def print_config_summary(config: DocUltraConfig) -> None:
    """打印增强的配置摘要（含 Provider 注册表和预设信息）."""

    # ── Provider 注册表 ──
    if config.providers:
        pt = Table(title="Provider 注册表", title_style="bold cyan")
        pt.add_column("名称", style="cyan")
        pt.add_column("类型/模型", style="green")
        pt.add_column("能力", style="yellow")
        pt.add_column("用途建议", style="dim")

        provider_roles = _suggest_roles(config)

        for name, prov in config.providers.items():
            caps_display = " ".join(
                f"[bold]{CAPABILITY_LABELS.get(c, c)}[/bold]"
                for c in prov.capabilities[:4]
            )
            pt.add_row(
                name,
                f"{prov.type}/{prov.model}",
                caps_display,
                provider_roles.get(name, ""),
            )
        console.print(pt)

    # ── 活跃预设信息 ──
    if config.active_preset:
        preset = config.presets.get(config.active_preset)
        if preset:
            desc_text = Text()
            desc_text.append("活跃预设: ", style="bold")
            desc_text.append(f"{config.active_preset}", style="bold cyan")
            desc_text.append(f" — {preset.description}", style="dim")
            console.print(desc_text)
            console.print()

    # ── 流水线阶段配置 ──
    table = Table(title="流水线各阶段 Provider 分配", title_style="bold")
    table.add_column("阶段", style="cyan", width=14)
    table.add_column("Provider", style="green", width=22)
    table.add_column("能力", style="yellow")
    table.add_column("温度", style="dim", width=6)

    table.add_row(
        "Stage0 解析",
        f"{config.parser.provider}/{config.parser.model}",
        _cap_tags_for_pc(config.parser, config),
        str(config.parser.temperature),
    )

    optimizer_rows = []
    for o in config.optimizers:
        optimizer_rows.append(f"{o.id}({o.provider}/{o.model})")
    table.add_row("Stage1 优化", "\n".join(optimizer_rows), "", "-")

    table.add_row(
        "Stage2 融合",
        f"{config.fuser.provider}/{config.fuser.model}",
        _cap_tags_for_pc(config.fuser, config),
        str(config.fuser.temperature),
    )
    table.add_row(
        "Stage3 检查",
        f"{config.checker.provider}/{config.checker.model}",
        _cap_tags_for_pc(config.checker, config),
        str(config.checker.temperature),
    )
    table.add_row(
        "Stage4 扩写",
        f"{config.expander.provider}/{config.expander.model}",
        _cap_tags_for_pc(config.expander, config),
        str(config.expander.temperature),
    )
    table.add_row(
        "Stage5 抛光",
        f"{config.polisher.provider}/{config.polisher.model}",
        _cap_tags_for_pc(config.polisher, config),
        str(config.polisher.temperature),
    )
    table.add_row(
        "↺ 最大轮次",
        str(config.pipeline.max_grill_rounds),
        "",
        "-",
    )

    console.print(table)
    console.print()


def _cap_tags_for_pc(pc, config: DocUltraConfig) -> str:
    """从 ProviderConfig 反向查找能力标签."""
    for name, prov in config.providers.items():
        if prov.type == pc.provider and prov.model == pc.model:
            caps = prov.capabilities[:4]
            return " ".join(
                f"[bold]{CAPABILITY_LABELS.get(c, c)}[/bold]" for c in caps
            )
    return ""


def _suggest_roles(config: DocUltraConfig) -> dict[str, str]:
    """根据能力标签建议各 Provider 的用途."""
    roles = {}
    for name, prov in config.providers.items():
        caps = set(prov.capabilities)
        suggestions = []
        if "high_quality" in caps:
            suggestions.append("检查/融合")
        if "creative" in caps:
            suggestions.append("优化/扩写")
        if "economical" in caps:
            suggestions.append("大批量/草稿")
        if "long_context" in caps:
            suggestions.append("长文档解析")
        if "reasoning" in caps:
            suggestions.append("需求分析")
        if "fast" in caps:
            suggestions.append("终审抛光")
        roles[name] = "/".join(suggestions[:3])
    return roles


# ═══════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════

@click.command()
@click.argument("input-file", type=click.Path(exists=True), required=False)
@click.option(
    "-o", "--output",
    default="./output.md",
    type=click.Path(),
    help="输出文件路径（默认: ./output.md）",
)
@click.option(
    "-c", "--config",
    "config_path",
    default=None,
    type=click.Path(exists=True),
    help="配置文件路径（默认: 自动查找 doc-ultra.config.yaml）",
)
@click.option(
    "-p", "--preset",
    "preset_name",
    default=None,
    type=str,
    help="文档类型预设: bid/patent/software_copyright/standard/project_application/knowledge_base/general/economical",
)
@click.option(
    "--auto-preset",
    is_flag=True,
    help="根据输入文档内容自动检测类型并应用对应预设",
)
@click.option(
    "--list-presets",
    is_flag=True,
    help="列出所有可用的文档类型预设",
)
@click.option(
    "--no-expand",
    is_flag=True,
    help="跳过扩写阶段",
)
@click.option(
    "--target-words",
    default=0,
    type=int,
    help="目标字数（触发扩写，0 表示不扩写）",
)
@click.option(
    "--check-only",
    is_flag=True,
    help="仅执行检查（跳过优化和扩写）",
)
@click.option(
    "--perspectives",
    default=None,
    type=int,
    help="并行优化视角数量（覆盖配置，范围: 2-5）",
)
@click.option(
    "--max-grill-rounds",
    default=None,
    type=int,
    help="检查循环最大轮次（覆盖配置）",
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="输出详细执行日志",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="仅解析需求，不实际调用模型",
)
@click.option(
    "--serve",
    is_flag=True,
    help="流水线执行完后启动 Web 预览服务",
)
@click.option(
    "--serve-only",
    is_flag=True,
    help="仅启动预览服务（不执行流水线）。有 .md 文件则预览该文件（单文件模式），否则预览 .doc-ultra/ 中间产物",
)
@click.option(
    "--preview",
    is_flag=True,
    help="直接预览指定的 .md 文件（不经过流水线），每次保存自动产生新版本快照",
)
@click.option(
    "--port",
    default=8765,
    type=int,
    help="预览服务端口（默认: 8765）",
)
@click.version_option(version="0.2.0", prog_name="doc-ultra")
def main(
    input_file: str,
    output: str,
    config_path: Optional[str],
    preset_name: Optional[str],
    auto_preset: bool,
    list_presets: bool,
    no_expand: bool,
    target_words: int,
    check_only: bool,
    perspectives: Optional[int],
    max_grill_rounds: Optional[int],
    verbose: bool,
    dry_run: bool,
    serve: bool,
    serve_only: bool,
    preview: bool,
    port: int,
) -> None:
    """doc-ultra v2 — 文档超融合处理工具。

    支持标书、专利、软著、团标、项目申报、知识库文档等类型。
    内置多 Provider 注册和智能预设系统。

    \b
    文档类型预设:
      bid                  — 招投标文档
      patent               — 专利文档
      software_copyright   — 软件著作权
      standard             — 团体/行业标准
      project_application  — 项目申报书
      knowledge_base       — 基于知识库的文档
      general              — 通用文档
      economical           — 极致省钱模式

    \b
    示例:
      doc-ultra 标书.md -p bid
      doc-ultra 专利初稿.md --auto-preset
      doc-ultra 申报书.md -p project_application -o 申报书终稿.md
      doc-ultra 文档.md --check-only --verbose
      doc-ultra 会议笔记.md                             # 直接预览（不跑流水线）
      doc-ultra 会议笔记.md --preview                    # 同上，显式预览
      doc-ultra --serve-only                             # 预览 .doc-ultra/ 中间产物
      doc-ultra 报告.md --serve-only                     # 单文件预览包含流水线产物
    """
    print_banner()

    # ── 列出预设（不需要输入文件）──
    if list_presets:
        config = load_config(config_path)
        _print_presets(config)
        return

    # ── 输入文件必填 ──
    if not input_file:
        console.print("[red]错误: 缺少 INPUT_FILE 参数（--list-presets 除外）[/red]")
        console.print("[dim]使用 --help 查看用法[/dim]")
        sys.exit(1)

    # ── 直接预览模式：给 .md 文件但不跑流水线 ──
    # 条件：有 input_file + 无任何处理标志（-p/--auto-preset/--check-only/dry-run）
    #       或者显式指定了 --preview
    processing_flags = any([preset_name, auto_preset, check_only, serve, dry_run, target_words > 0])
    direct_preview = preview or (not processing_flags and not serve_only and Path(input_file).suffix == ".md")
    
    if direct_preview:
        file_path = Path(input_file).resolve()
        console.print()
        console.print(
            Panel.fit(
                f"[bold green]📄 直接预览模式[/bold green]\n"
                f"文件: [cyan]{file_path.name}[/cyan]\n"
                f"每次保存都会自动生成新版本快照，可在浏览器中对比差异。",
                border_style="green",
            )
        )
        console.print(f"[dim]浏览器打开: http://127.0.0.1:{port}/[/dim]")
        console.print("[dim]按 Ctrl+C 停止服务[/dim]")
        console.print()

        server = PreviewServer(
            work_dir=file_path.parent,
            port=port,
            original_file=file_path,
            open_browser=True,
            mode="file",
        )
        server.start()
        server.wait()
        console.print("\n[dim]预览服务已停止[/dim]")
        return

    # ── 加载配置 (需要流水线处理) ──
    try:
        config = load_config(config_path, preset=preset_name or "")
    except Exception as e:
        console.print(f"[red]配置加载失败: {e}[/red]")
        sys.exit(1)

    # ── 自动检测文档类型 ──
    if auto_preset:
        raw_text = Path(input_file).read_text(encoding="utf-8")
        detected = detect_document_type(raw_text)
        if detected != "general":
            try:
                config = apply_preset(config, detected)
                console.print(
                    f"[green]自动检测文档类型: [bold]{detected}[/bold][/green]"
                )
            except KeyError:
                pass
        else:
            console.print("[dim]未检测到特定文档类型，使用通用模式[/dim]")

    # ── 覆盖配置参数 ──
    if perspectives and 2 <= perspectives <= 5:
        config.optimizers = config.optimizers[:perspectives]
    if max_grill_rounds:
        config.pipeline.max_grill_rounds = max_grill_rounds

    print_config_summary(config)

    # ── 干运行 ──
    if dry_run:
        console.print(
            "[yellow]DRY RUN 模式 — 仅解析需求，不调用模型[/yellow]"
        )
        raw = Path(input_file).read_text(encoding="utf-8")
        console.print(
            f"[dim]输入文件长度: {len(raw)} 字符[/dim]"
        )
        if config.active_preset:
            console.print(
                f"[dim]预设: {config.active_preset}[/dim]"
            )
        console.print("[green]干运行完成，未实际调用模型[/green]")
        return

    # ── 仅启动预览服务（流水线产物）──
    if serve_only:
        console.print(
            "[green]启动预览服务，监听 .doc-ultra/ 目录...[/green]"
        )
        console.print(f"[dim]浏览器打开: http://127.0.0.1:{port}/[/dim]")
        input_path = Path(input_file) if input_file else None
        server = PreviewServer(
            work_dir=Path(".doc-ultra"),
            port=port,
            original_file=input_path if input_path and input_path.exists() else None,
            open_browser=True,
            mode="pipeline",
        )
        server.start()
        console.print("[green]预览服务已启动，按 Ctrl+C 停止[/green]")
        console.print()
        server.wait()
        console.print("\n[dim]预览服务已停止[/dim]")
        return

    # ── 执行流水线 ──
    skip_expand = no_expand or target_words <= 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("[cyan]执行流水线...", total=None)

        try:
            runner = PipelineRunner(config)
            output_path = runner.run(
                input_file=input_file,
                output_path=output,
                skip_expand=skip_expand,
                target_words=target_words,
                check_only=check_only,
            )
            progress.update(task, completed=True)
        except Exception as e:
            progress.update(task, completed=True)
            console.print(f"\n[red]流水线执行失败: {e}[/red]")
            if verbose:
                import traceback
                console.print(traceback.format_exc())
            sys.exit(1)

    console.print()
    console.print(
        f"[green bold]\u2713 完成！[/green bold] 输出文件: [cyan]{output_path}[/cyan]"
    )
    console.print("[dim]中间产物保存在: .doc-ultra/[/dim]")
    
    # ── 启动预览（--serve）──
    if serve:
        console.print()
        console.print(
            "[green]启动预览服务，监听 .doc-ultra/ 目录...[/green]"
        )
        console.print(f"[dim]浏览器打开: http://127.0.0.1:{port}/[/dim]")
        input_path = Path(input_file)
        server = PreviewServer(
            work_dir=Path(".doc-ultra"),
            port=port,
            original_file=input_path if input_path.exists() else None,
            open_browser=True,
            mode="pipeline",
        )
        server.start()
        console.print("[green]预览服务已启动，按 Ctrl+C 停止[/green]")
        console.print()
        server.wait()
        console.print("\n[dim]预览服务已停止[/dim]")
    
    if verbose:
        log_path = Path(".doc-ultra") / "pipeline-execution.log"
        if log_path.exists():
            console.print()
            console.print("[bold]执行日志:[/bold]")
            console.print(log_path.read_text(encoding="utf-8"))


def _print_presets(config: DocUltraConfig) -> None:
    """打印所有预设列表."""
    presets = list_presets(config)
    if not presets:
        console.print("[yellow]配置文件中未定义任何预设[/yellow]")
        return

    table = Table(title="可用文档类型预设", title_style="bold cyan")
    table.add_column("预设名称", style="cyan")
    table.add_column("适用场景", style="green")
    table.add_column("解析", style="dim")
    table.add_column("优化视角", style="dim")
    table.add_column("融合", style="dim")
    table.add_column("检查", style="dim")

    for p in presets:
        preset = config.presets.get(p["name"])
        if preset:
            opt_count = len(preset.optimizer_assignments)
            table.add_row(
                p["name"],
                p["description"],
                preset.parser_ref or "-",
                f"{opt_count} 个",
                preset.fuser_ref or "-",
                preset.checker_ref or "-",
            )

    console.print(table)
    console.print()
    console.print("[dim]使用方式: doc-ultra <文件> -p <预设名称>[/dim]")


if __name__ == "__main__":
    main()
