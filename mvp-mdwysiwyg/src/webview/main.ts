import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/globals.css';
import './styles/tailwind.css';
import { useDocumentStore } from './stores/documentStore';
import { demoHeadings, demoContent, demoRevisions, demoBodies, demoDiffChanges } from './demo-data';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.mount('#app');

// Detect standalone mode (not inside VS Code WebView)
const isStandalone = typeof (window as any).acquireVsCodeApi === 'undefined';

if (isStandalone) {
  // Inject demo data into stores after mount
  const doc = useDocumentStore();
  doc.setContent(demoContent);
  doc.setHeadings(demoHeadings);
  doc.setRevisions(demoRevisions, null);
  doc.setDiffResult(demoDiffChanges, { inserted: 140, deleted: 48, modified: 6 });

  // Expose demo bodies globally so MdCard can access them
  (window as any).__demoBodies = demoBodies;

  // Initialize Mermaid rendering after DOM is ready
  setTimeout(async () => {
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        fontFamily: 'Inter, system-ui, sans-serif',
        flowchart: { htmlLabels: true, curve: 'basis' },
        sequence: { mirrorActors: false },
      });
      const mermaidEls = document.querySelectorAll('.mermaid');
      if (mermaidEls.length > 0) {
        await mermaid.run({ nodes: mermaidEls as NodeListOf<HTMLElement> });
      }
    } catch (e) {
      console.warn('[demo] Mermaid rendering skipped:', e);
    }
  }, 300);
}
