// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Location, MarkdownString, Position, Range, workspace } from "vscode";
import { uniqWith } from "lodash";

interface Hover {
	range: Range;
	contents: MarkdownString[];
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "switchenumgenerator" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const codeActionProvider = vscode.languages.registerCodeActionsProvider("cpp", new SwitchGenerator());

	const addCasesDisposable = vscode.commands.registerCommand("switchenumgenerator.addCases", (document: vscode.TextDocument, range: vscode.Range) => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		addCases(document, range);
	});

	context.subscriptions.push(addCasesDisposable);

	context.subscriptions.push(codeActionProvider);
}

const functionHandlerExceptions = ["get"];

export class SwitchGenerator implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

	public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.CodeAction[] | undefined> {
		return new Promise((resolve) => {
			this.isValidSwitch(document, range)
				.then((valid) => {
					if (!valid) {
						resolve(undefined);
					}

					this.createFix(document, range).then((generateSwitch) => {
						resolve([generateSwitch]);
					});
				})
				.catch(() => {
					resolve(undefined);
				});
		});
	}

	private async isValidSwitch(document: vscode.TextDocument, range: vscode.Range) {
		const start = range.start;
		const line = document.lineAt(start.line);

		if (!document.getText(line.range).includes("switch")) {
			return false;
		}

		const allDefinitions: Location[] = [];
		for (let lineNumber = range.start.line; lineNumber <= range.end.line; lineNumber++) {
			const line = document.lineAt(lineNumber);
			const startCharNumber = lineNumber === range.start.line ? range.start.character : 0;
			const endCharNumber = lineNumber === range.end.line ? range.end.character : line.range.end.character;
			for (let charNumber = startCharNumber; charNumber <= endCharNumber; charNumber++) {
				const foundDefinitions = await vscode.commands.executeCommand<Location[] | undefined>(
					"vscode.executeDefinitionProvider",
					document.uri,
					new Position(lineNumber, charNumber)
				);
				if (foundDefinitions?.length) {
					allDefinitions.push(foundDefinitions[0]);
				}
			}
		}

		if (!allDefinitions.length) {
			return false;
		}

		const definitions = uniqWith(allDefinitions, (a, b) => a.range.isEqual(b.range));
		var symbols: vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
			"vscode.executeDocumentSymbolProvider",
			document.uri
		);

		for (const definition of definitions) {
			const hoverRes = await vscode.commands.executeCommand<Hover[]>("vscode.executeHoverProvider", document.uri, definition.range.start);

			var hoverVal = hoverRes[0].contents[0].value;

			const word = document.getText(definition.range);
			const lineText = document.getText(document.lineAt(definition.range.start.line).range);

			if (hoverVal.includes(word)) {
				return true;
			}
		}
		return false;
	}

	private async createFix(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.CodeAction> {
		const fix = new vscode.CodeAction(`Generate Switch For Enums`, vscode.CodeActionKind.QuickFix);

		var a: vscode.Command = { command: "switchenumgenerator.addCases", title: "Add Cases", arguments: [document, range] };

		fix.command = a;

		return fix;
	}
}

async function addCases(document: vscode.TextDocument, range: vscode.Range) {
	console.log("ADD CASES COMMAND");
	const start = range.start;
	const line = document.lineAt(start.line);

	if (!document.getText(line.range).includes("switch")) {
		return;
	}

	const allDefinitions: Location[] = [];
	for (let lineNumber = range.start.line; lineNumber <= range.end.line; lineNumber++) {
		const line = document.lineAt(lineNumber);
		const startCharNumber = lineNumber === range.start.line ? range.start.character : 0;
		const endCharNumber = lineNumber === range.end.line ? range.end.character : line.range.end.character;
		for (let charNumber = startCharNumber; charNumber <= endCharNumber; charNumber++) {
			const foundDefinitions = await vscode.commands.executeCommand<Location[] | undefined>(
				"vscode.executeDefinitionProvider",
				document.uri,
				new Position(lineNumber, charNumber)
			);
			if (foundDefinitions?.length) {
				allDefinitions.push(foundDefinitions[0]);
			}
		}
	}

	if (!allDefinitions.length) {
		return;
	}

	const definitions = uniqWith(allDefinitions, (a, b) => a.range.isEqual(b.range));
	var symbols: vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
		"vscode.executeDocumentSymbolProvider",
		document.uri
	);

	for (const definition of definitions) {
		console.log("definition");
		console.log(definition);
		const hoverRes = await vscode.commands.executeCommand<Hover[]>("vscode.executeHoverProvider", document.uri, definition.range.start);

		if (!hoverRes) {
			// continue;
		}

		console.log(hoverRes);
		console.log("hoverValue");
		console.log(hoverRes[0].contents[0].value);
		var hoverVal = hoverRes[0].contents[0].value;

		const word = document.getText(definition.range);
		const lineText = document.getText(document.lineAt(definition.range.start.line).range);

		console.log(word);
		console.log(lineText);

		if (hoverVal.includes(word)) {
			var prefix = hoverVal.replaceAll(word, "");
			prefix = prefix.substring(6);
			prefix = prefix.replaceAll("```", "");
			prefix = prefix.replaceAll("\n", "");
			prefix = prefix.replaceAll("\r", "");
			prefix = prefix.trim();

			var edit = new vscode.WorkspaceEdit();
			var caseTemplate = "\n case " + prefix + "::";
			console.log("CASE TEMPLATE");
			console.log(caseTemplate);
			edit.insert(document.uri, line.range.end, caseTemplate);
			workspace.applyEdit(edit).then(() => {
				var addedLine = document.lineAt(line.lineNumber + 1);

				vscode.CompletionList;

				vscode.commands
					.executeCommand<vscode.CompletionList>("vscode.executeCompletionItemProvider", document.uri, addedLine.range.end)
					.then((compItems) => {
						if (compItems.items.length > 0) {
							var allCases = "";
							for (var i = 1; i < compItems.items.length; i++) {
								allCases += "\ncase " + prefix + "::" + compItems.items[i].label.toString() + ":\nbreak;";
							}

							var finalEdit = new vscode.WorkspaceEdit();

							finalEdit.insert(document.uri, addedLine.range.end, compItems.items[0].label.toString() + ":\nbreak;" + allCases);
							workspace.applyEdit(finalEdit);
						} else {
							var finalEdit = new vscode.WorkspaceEdit();
							finalEdit.delete(document.uri, addedLine.range);
							workspace.applyEdit(finalEdit);
						}
					});
			});
		}
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
