import { File, Upload, X } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  /** 允许的文件类型，如 "image/*,.pdf" */
  accept?: string
  /** 最大文件大小（字节） */
  maxSize?: number
  /** 是否允许多选 */
  multiple?: boolean
  /** 文件变化回调 */
  onChange?: (files: File[]) => void
  /** 自定义 className */
  className?: string
  /** 禁用状态 */
  disabled?: boolean
}

function FileUpload({
  accept,
  maxSize,
  multiple = false,
  onChange,
  className,
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = React.useState<File[]>([])
  const [dragOver, setDragOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function validateFiles(incoming: File[]): File[] {
    setError(null)
    if (maxSize) {
      const oversized = incoming.find((f) => f.size > maxSize)
      if (oversized) {
        const maxMB = (maxSize / 1024 / 1024).toFixed(1)
        setError(`文件 "${oversized.name}" 超过最大限制 ${maxMB}MB`)
        return []
      }
    }
    return incoming
  }

  function handleFiles(incoming: File[]) {
    const valid = validateFiles(incoming)
    if (valid.length === 0) return
    const next = multiple ? [...files, ...valid] : valid.slice(0, 1)
    setFiles(next)
    onChange?.(next)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const dropped = Array.from(e.dataTransfer.files)
    handleFiles(dropped)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!disabled) setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    handleFiles(selected)
    // 重置 input 以允许重复选择相同文件
    e.target.value = ""
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index)
    setFiles(next)
    onChange?.(next)
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* 拖拽区域 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            if (!disabled) inputRef.current?.click()
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center transition-all duration-200",
          "bg-[var(--lg-surface-glass)] backdrop-blur-sm",
          "border-[var(--lg-border)]",
          dragOver && "border-primary bg-accent",
          disabled && "cursor-not-allowed opacity-50",
          !disabled &&
            "cursor-pointer hover:border-primary/60 hover:bg-accent/50"
        )}
      >
        <Upload
          className={cn(
            "size-8 text-muted-foreground transition-colors",
            dragOver && "text-primary"
          )}
        />
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">点击上传</span>{" "}
          或拖拽文件到此处
        </div>
        {accept && (
          <p className="text-xs text-muted-foreground">支持格式：{accept}</p>
        )}
        {maxSize && (
          <p className="text-xs text-muted-foreground">
            最大 {(maxSize / 1024 / 1024).toFixed(0)}MB
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* 错误信息 */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* 已选文件列表 */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2",
                "border border-[var(--lg-border)] bg-[var(--lg-surface-glass)] backdrop-blur-sm"
              )}
            >
              <File className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm text-foreground">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(file.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { FileUpload, type FileUploadProps }
