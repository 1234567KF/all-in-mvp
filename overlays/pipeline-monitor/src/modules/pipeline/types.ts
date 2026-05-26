// Pipeline 数据模型类型
export interface Pipeline {
  id: string;
  name: string;
  status: "RUNNING" | "DONE" | "FAILED" | "CANCELLED";
  mode: "full" | "incremental" | "simple";
  taskDesc: string;
  sessionName: string;
  createdAt: string;
  updatedAt: string;
}

// 创建 Pipeline 请求体
export interface PipelineCreate {
  name: string;
  mode?: "full" | "incremental" | "simple";
  taskDesc?: string;
  sessionName?: string;
}

// 更新 Pipeline 请求体
export interface PipelineUpdate {
  status: "DONE" | "FAILED" | "CANCELLED";
}
