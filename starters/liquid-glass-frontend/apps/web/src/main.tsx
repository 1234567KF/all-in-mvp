import "./index.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import App from "./App"
import { ThemeProvider } from "./components/providers/theme-provider"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system">
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
