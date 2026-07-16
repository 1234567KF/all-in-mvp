import { useEffect, useRef, useState } from "react"

interface AsyncDataResult<T> {
  data: T | null
  loading: boolean
  error: unknown
  refetch: () => void
}

/**
 * 通用异步数据加载 hook
 * @param condition - 触发加载的条件（falsy 时不请求）
 * @param fetcher   - 异步数据获取函数
 * @param depsOverride - 可选依赖数组（覆盖默认的 [condition] 依赖）
 */
export function useAsyncData<T>(
  condition: unknown,
  fetcher: () => Promise<T>,
  depsOverride?: unknown[]
): AsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // 保持 fetcher 引用最新（不在 effect 内读 ref，避免 render-phase 访问）
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  // 用 ref 持有最新 run 供 refetch 调用，避免 useCallback 依赖漂移
  const runRef = useRef<() => void>(() => {})

  const deps = depsOverride ?? [condition]

  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (!condition) return
      setLoading(true)
      setError(null)
      fetcherRef
        .current()
        .then((result) => {
          if (!cancelled) setData(result)
        })
        .catch((err) => {
          if (!cancelled) setError(err)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    runRef.current = run
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, refetch: () => runRef.current() }
}
