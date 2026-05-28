import * as vscode from 'vscode';
import { MdWysiwygEditorProvider } from './providers/webviewProvider';

export function activate(context: vscode.ExtensionContext) {
  // Register custom editor provider
  context.subscriptions.push(MdWysiwygEditorProvider.register(context));

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mdWysiwyg.open', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith('.md')) {
        vscode.window.showWarningMessage('Please open a .md file first');
        return;
      }
      await vscode.commands.executeCommand(
        'vscode.openWith',
        editor.document.uri,
        MdWysiwygEditorProvider.viewType
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mdWysiwyg.setBaseVersion', () => {
      vscode.window.showInformationMessage('Set base version: use the toolbar in the WYSIWYG view');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mdWysiwyg.clearBaseVersion', () => {
      vscode.window.showInformationMessage('Clear base version: use the toolbar in the WYSIWYG view');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mdWysiwyg.toggleView', () => {
      vscode.window.showInformationMessage('Toggle view: use the toolbar buttons in the WYSIWYG view');
    })
  );
}

export function deactivate() {}
