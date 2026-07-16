// 团队共享测试环境连接信息（内部工具，凭据可硬编码在 skill 里以便一键部署）。
//
// 端口段划分（详见 references/ci-guide.md §9）：
//   11070          模板 liquid-glass-starter 自身 self-deploy 保留
//   11080          预留给主业务项目的固定端口（不参与自动分配）
//   11081-11199    新项目递增分配段（skill port-allocator 覆盖）
//   11200+         预留（可作为其他用途或独立服务）
//
// 凭据轮换时只改本文件一处；后续如需读环境变量兜底，可在 test-server.ts 里
// 追加 process.env.TEST_SERVER_PASSWORD 优先级 > 硬编码值。

export const TEST_SERVER = {
  host: "192.168.110.214",
  port: 63022,
  user: "wecode",
  password: "wecode",
  // 新项目分配段（含首尾，闭区间）；模板 self-deploy 11070 / 预留项目 11080 均不在段内
  portRangeStart: 11081,
  portRangeEnd: 11199,
} as const

export type TestServer = typeof TEST_SERVER
