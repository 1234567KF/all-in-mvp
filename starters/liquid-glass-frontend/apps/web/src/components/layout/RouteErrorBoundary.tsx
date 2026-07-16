// 提取自 frontend/src/components/RouteErrorBoundary.tsx
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

interface Props {
  children: ReactNode
  /** 路由路径变化时用作 key，自动重置错误状态 */
  resetKey?: string
}

interface State {
  error: Error | null
}

/**
 * 路由级错误边界：拦截单个页面组件渲染期抛出的异常，
 * 避免一个页面崩溃导致整棵 React 树卸载（表现为"页面变黑"）。
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 仅开发期打印，生产可替换为上报
    console.error("[RouteErrorBoundary]", error, info.componentStack)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private handleRetry = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <Empty className="min-h-[60vh] border-none">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-12 bg-destructive/15 text-destructive"
            >
              <AlertTriangle className="size-6" />
            </EmptyMedia>
            <EmptyTitle>页面渲染出现异常</EmptyTitle>
            <EmptyDescription>
              数据加载失败或格式异常，已阻止错误蔓延。可点击下方按钮重试，或切换到其他页面。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {import.meta.env.DEV && (
              <pre className="max-h-32 w-full overflow-auto rounded-md bg-muted/40 p-2 text-left font-mono text-[11px] text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleRetry}>
              <RefreshCw data-icon="inline-start" />
              重试
            </Button>
          </EmptyContent>
        </Empty>
      )
    }
    return this.props.children
  }
}
