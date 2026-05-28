import * as vscode from 'vscode';
import { parseMarkdown } from '../services/markdownParser';
import { computeDiff } from '../services/diffEngine';
import {
  loadRevisionStore,
  setBaseVersion,
  clearBaseVersion,
  acceptChange,
  rejectChange,
  acceptAllChanges,
  rejectAllChanges,
} from '../services/revisionManager';
import type {
  DocumentLoadedPayload,
  DocumentSavePayload,
  RequestDiffPayload,
  AcceptChangePayload,
  RejectChangePayload,
  SetBasePayload,
} from '../types/index';

export class MdWysiwygEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'mdWysiwyg.reader';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MdWysiwygEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      MdWysiwygEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist/webview'),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Send document content when WebView is ready
    const sendDocument = async () => {
      const content = document.getText();
      const { headings } = parseMarkdown(content);
      const revisionStore = await loadRevisionStore(document.uri.fsPath);
      const payload: DocumentLoadedPayload = { content, headings, revisionStore };
      webviewPanel.webview.postMessage({ type: 'document:loaded', payload });
    };

    // Handle messages from WebView
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      const { type, payload } = msg;

      switch (type) {
        case 'ui:ready':
          await sendDocument();
          break;

        case 'document:save': {
          const { content } = payload as DocumentSavePayload;
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
          );
          await vscode.workspace.applyEdit(edit);
          await document.save();
          webviewPanel.webview.postMessage({
            type: 'document:saveSuccess',
            payload: { timestamp: new Date().toISOString() },
          });
          break;
        }

        case 'document:requestDiff': {
          const { v0, v1 } = payload as RequestDiffPayload;
          const result = computeDiff(v0, v1);
          webviewPanel.webview.postMessage({
            type: 'diff:result',
            payload: result,
          });
          break;
        }

        case 'revision:setBase': {
          const { content } = payload as SetBasePayload;
          const store = await setBaseVersion(document.uri.fsPath, content);
          webviewPanel.webview.postMessage({
            type: 'revision:updated',
            payload: { revisions: store.revisions, baseVersion: store.baseVersion },
          });
          break;
        }

        case 'revision:clearBase': {
          const store = await clearBaseVersion(document.uri.fsPath);
          webviewPanel.webview.postMessage({
            type: 'revision:updated',
            payload: { revisions: store.revisions, baseVersion: store.baseVersion },
          });
          break;
        }

        case 'revision:accept': {
          const { changeId } = payload as AcceptChangePayload;
          const store = await acceptChange(document.uri.fsPath, changeId);
          webviewPanel.webview.postMessage({
            type: 'revision:updated',
            payload: { revisions: store.revisions, baseVersion: store.baseVersion },
          });
          break;
        }

        case 'revision:reject': {
          const { changeId } = payload as RejectChangePayload;
          const store = await rejectChange(document.uri.fsPath, changeId);
          webviewPanel.webview.postMessage({
            type: 'revision:updated',
            payload: { revisions: store.revisions, baseVersion: store.baseVersion },
          });
          break;
        }

        case 'revision:acceptAll': {
          const store = await acceptAllChanges(document.uri.fsPath);
          webviewPanel.webview.postMessage({
            type: 'revision:updated',
            payload: { revisions: store.revisions, baseVersion: store.baseVersion },
          });
          break;
        }

        case 'revision:rejectAll': {
          const store = await rejectAllChanges(document.uri.fsPath);
          webviewPanel.webview.postMessage({
            type: 'revision:updated',
            payload: { revisions: store.revisions, baseVersion: store.baseVersion },
          });
          break;
        }
      }
    });

    // Listen for external file changes
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        const content = document.getText();
        const { headings } = parseMarkdown(content);
        webviewPanel.webview.postMessage({
          type: 'document:changed',
          payload: { content, headings },
        });
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const distUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist/webview')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}' https://unpkg.com; img-src ${webview.cspSource} https: data:; connect-src ${webview.cspSource};">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link href="${distUri}/assets/index.css" rel="stylesheet">
  <title>MD WYSIWYG Reader</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="https://unpkg.com/mermaid@10/dist/mermaid.min.js"></script>
  <script nonce="${nonce}" src="${distUri}/assets/index.js"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
