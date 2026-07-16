import * as React from "react"
import { FormProvider, useFormContext } from "react-hook-form"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const Form = FormProvider

type FormFieldContextValue = {
  name: string
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

function FormField({
  name,
  render,
}: {
  name: string
  render: (field: {
    value: unknown
    onChange: (val: unknown) => void
    onBlur: () => void
    ref: React.Ref<unknown>
    name: string
    disabled?: boolean
  }) => React.ReactElement
}) {
  const { getFieldState } = useFormContext()
  const fieldState = getFieldState(name)

  return (
    <FormFieldContext.Provider value={{ name }}>
      {render({
        value: undefined,
        onChange: () => {},
        onBlur: () => {},
        ref: null,
        name,
        disabled: false,
      })}
      {fieldState.error && <FormMessage />}
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const fieldState = getFieldState(fieldContext?.name ?? "")

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

function FormItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("flex flex-col gap-1.5", className)} {...props} />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"label">) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      className={cn(
        "text-sm text-muted-foreground",
        error && "text-destructive",
        className
      )}
      htmlFor={formItemId}
      {...(props as React.ComponentPropsWithoutRef<typeof Label>)}
    />
  )
}

function FormControl(props: React.ComponentPropsWithoutRef<"div">) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <div
      id={formItemId}
      aria-describedby={
        !error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      id={formDescriptionId}
      className={cn("text-[0.8rem] text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormMessage({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message) : children

  if (!body) return null

  return (
    <p
      id={formMessageId}
      className={cn("text-[0.8rem] font-medium text-destructive", className)}
      {...(props as React.ComponentPropsWithoutRef<"p">)}
    >
      {body}
    </p>
  )
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
}
