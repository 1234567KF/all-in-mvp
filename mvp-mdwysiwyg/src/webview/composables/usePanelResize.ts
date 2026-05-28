import { onMounted, onUnmounted } from 'vue';

export function usePanelResize(
  panelEl: () => HTMLElement | null,
  dividerEl: () => HTMLElement | null,
  side: 'left' | 'right',
  widthRef: { value: number },
  collapsedRef: { value: boolean }
) {
  let startX = 0;
  let startWidth = 0;
  let isDragging = false;

  function onMouseDown(e: MouseEvent) {
    const panel = panelEl();
    if (!panel || collapsedRef.value) return;
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    isDragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const divider = dividerEl();
    if (divider) divider.style.background = 'color-mix(in srgb, var(--ring) 30%, transparent)';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const delta = side === 'right' ? startX - e.clientX : e.clientX - startX;
    const newWidth = Math.max(32, Math.min(400, startWidth + delta));
    const panel = panelEl();
    if (panel) {
      panel.style.width = newWidth + 'px';
      panel.style.flex = 'none';
      widthRef.value = newWidth;
    }
  }

  function onMouseUp() {
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const divider = dividerEl();
    if (divider) divider.style.background = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  onMounted(() => {
    const divider = dividerEl();
    if (divider) divider.addEventListener('mousedown', onMouseDown);
  });

  onUnmounted(() => {
    const divider = dividerEl();
    if (divider) divider.removeEventListener('mousedown', onMouseDown);
  });
}
