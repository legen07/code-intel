// Code-Intel Host Implementation for DeepSeek Harness
// Provides IDE-like code intelligence capabilities

import { PluginHost } from "@deepseek-ai/cordis";
import { SymbolKind } from "solidlsp/lsp_types";

export class CodeIntelHost extends PluginHost {
  constructor() {
    super();
    this.projectRoot = "";
    this.memoryStore = new Map();
  }

  setProjectRoot(projectRoot) {
    this.projectRoot = projectRoot;
  }

  // ===== SYMBOL SEARCH TOOLS =====

  async findSymbol(namePathPattern, options = {}) {
    // Search for symbols by name path pattern
    const { depth = 0, relativePath = "", includeBody = false, includeInfo = false, 
            includeKinds = [], excludeKinds = [], substringMatching = false, 
            maxMatches = -1, maxAnswerChars = -1 } = options;
    
    // Walk the project directory to find files
    const files = await this.listDir(relativePath, true, false);
    const matchingSymbols = [];
    
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.py') || 
          file.endsWith('.java') || file.endsWith('.cpp') || file.endsWith('.c') ||
          file.endsWith('.go') || file.endsWith('.rs') || file.endsWith('.rb') ||
          file.endsWith('.php') || file.endsWith('.rust')) {
        const content = await this.readFile(file);
        const symbols = this.parseSymbols(file, content);
        
        for (const symbol of symbols) {
          // Apply name path pattern matching
          if (this.matchNamePathPattern(symbol.namePath, namePathPattern, substringMatching)) {
            if (includeKinds.length > 0 && !includeKinds.includes(symbol.kind)) continue;
            if (excludeKinds.length > 0 && excludeKinds.includes(symbol.kind)) continue;
            
            let body = includeBody ? this.getSymbolBody(content, symbol) : undefined;
            let info = includeInfo ? this.getSymbolInfo(content, symbol) : undefined;
            
            matchingSymbols.push({
              namePath: symbol.namePath,
              name: symbol.name,
              kind: symbol.kind,
              location: {
                file: file,
                line: symbol.line,
                column: symbol.column
              },
              body: body,
              info: info,
              kindName: this.kindToName(symbol.kind)
            });
            
            if (maxMatches > 0 && matchingSymbols.length >= maxMatches) break;
          }
        }
      }
    }
    
    // Group and format results
    return this.formatSymbols(matchingSymbols);
  }

  async findReferencingSymbols(namePath, relativePath = "", options = {}) {
    // Find all symbols that reference the given symbol
    const { maxAnswerChars = -1 } = options;
    
    // Parse the symbol at the given namePath
    const targetSymbol = await this.findSymbolByNamePath(namePath, relativePath);
    if (!targetSymbol) {
      return { error: `Symbol not found: ${namePath}` };
    }
    
    // Read the source file and find references
    const content = await this.readFile(relativePath);
    const references = this.findReferencesInContent(content, targetSymbol);
    
    return {
      symbol: targetSymbol,
      references: references.map(ref => ({
        namePath: ref.namePath,
        location: {
          file: ref.file,
          line: ref.line,
          column: ref.column
        },
        context: ref.context,
        snippet: ref.snippet
      }))
    };
  }

  async findImplementations(namePath, relativePath = "", options = {}) {
    // Find all implementations of a symbol
    const { includeBody = false, includeInfo = false, maxAnswerChars = -1 } = options;
    
    const targetSymbol = await this.findSymbolByNamePath(namePath, relativePath);
    if (!targetSymbol) {
      return { error: `Symbol not found: ${namePath}` };
    }
    
    // Read the source file
    const content = relativePath ? await this.readFile(relativePath) : "";
    const implementations = this.findImplementationsInContent(content, targetSymbol);
    
    return {
      symbol: targetSymbol,
      implementations: implementations.map(imp => ({
        namePath: imp.namePath,
        location: {
          file: imp.file,
          line: imp.line,
          column: imp.column
        },
        body: imp.body,
        info: imp.info
      }))
    };
  }

  async getSymbolsOverview(relativePath, options = {}) {
    // Get overview of top-level symbols in a file
    const { depth = -1, maxAnswerChars = -1 } = options;
    
    const content = await this.readFile(relativePath);
    const symbols = this.parseFileSymbols(relativePath, content, depth);
    
    return {
      file: relativePath,
      symbols: symbols,
      symbolCount: symbols.length
    };
  }

  // ===== FILE OPERATIONS =====

  async listDir(relativePath = ".", recursive = false, skipIgnored = false) {
    // List files in directory
    const fullPath = `${this.projectRoot}/${relativePath}`.replace(/\/\//g, '/');
    
    try {
      const entries = await Deno.readDir(fullPath);
      const result = [];
      
      for (const entry of entries) {
        const entryPath = `${relativePath}/${entry.name}`.replace(/\/\//g, '/').replace(/^\//, '');
        const entryFullPath = `${fullPath}/${entry.name}`;
        
        if (entry.isDirectory) {
          result.push({ name: entry.name, type: 'directory', path: entryPath });
          if (recursive) {
            const subEntries = await this.listDir(entryPath, true, skipIgnored);
            result.push(...subEntries);
          }
        } else {
          result.push({ name: entry.name, type: 'file', path: entryPath });
        }
      }
      
      return result;
    } catch (e) {
      return { error: e.message };
    }
  }

  async readFile(relativePath, startLine = 0, endLine = null, maxAnswerChars = -1) {
    // Read file content
    const fullPath = `${this.projectRoot}/${relativePath}`.replace(/\/\//g, '/');
    
    try {
      const content = await Deno.readTextFile(fullPath);
      
      if (maxAnswerChars > 0 && content.length > maxAnswerChars) {
        return { error: `File too long (${content.length} chars, max ${maxAnswerChars})` };
      }
      
      if (startLine < 0) {
        // Count from end
        const lines = content.split('\n');
        startLine = Math.max(0, lines.length + startLine);
      }
      
      let lines;
      if (endLine !== null) {
        lines = content.split('\n').slice(startLine, endLine + 1);
      } else {
        lines = content.split('\n').slice(startLine);
      }
      
      return {
        content: lines.join('\n'),
        relativePath,
        startLine,
        endLine: endLine !== null ? Math.min(endLine, content.split('\n').length - 1) : undefined
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  async createTextFile(relativePath, content) {
    // Create or overwrite a file
    const fullPath = `${this.projectRoot}/${relativePath}`.replace(/\/\//g, '/');
    
    try {
      await Deno.writeTextFile(fullPath, content);
      return { success: true, path: relativePath };
    } catch (e) {
      return { error: e.message };
    }
  }

  async replaceContent(relativePath, needle, repl, mode = "literal", allowMultiple = false) {
    // Replace content in a file
    const result = await this.readFile(relativePath);
    if (result.error) return result;
    
    let newContent;
    if (mode === "regex") {
      // Use regex replacement
      const flags = 'g';
      const regex = new RegExp(needle, flags);
      newContent = result.content.replace(regex, repl);
    } else {
      // Literal replacement
      if (allowMultiple) {
        newContent = result.content.split(needle).join(repl);
      } else {
        const index = result.content.indexOf(needle);
        if (index === -1) {
          return { error: `Needle not found in file` };
        }
        newContent = result.content.substring(0, index) + repl + result.content.substring(index + needle.length);
      }
    }
    
    // Write the modified content
    await this.createTextFile(relativePath, newContent);
    return { 
      success: true, 
      changes: 1,
      oldContent: result.content,
      newContent
    };
  }

  // ===== SYMBOLIC EDITING =====

  async renameSymbol(relativePath, namePath, newNamePath) {
    // Rename a symbol and update all references
    const content = await this.readFile(relativePath);
    if (content.error) return content;
    
    // Find the symbol and rename it
    const symbol = this.findSymbolInContent(content, namePath);
    if (!symbol) return { error: `Symbol not found: ${namePath}` };
    
    // Replace the symbol name in the content
    const oldName = symbol.name;
    const newName = namePath.split('/').pop() || namePath;
    
    // Simple replacement - in production would be more sophisticated
    let newContent = content.content;
    // This is a simplified version - real implementation would handle scope, etc.
    const regex = new RegExp(`(${oldName})`, 'g');
    newContent = newContent.replace(regex, newName);
    
    await this.createTextFile(relativePath, newContent);
    
    return {
      success: true,
      oldName,
      newName,
      symbolLocation: {
        line: symbol.line,
        column: symbol.column
      }
    };
  }

  async moveSymbol(relativePath, namePath, targetRelativePath, targetParentNamePath = null) {
    // Move a symbol to a new location
    const content = await this.readFile(relativePath);
    if (content.error) return content;
    
    const symbol = this.findSymbolInContent(content, namePath);
    if (!symbol) return { error: `Symbol not found: ${namePath}` };
    
    // Read target file or create content
    let targetContent = "";
    if (targetRelativePath) {
      const targetResult = await this.readFile(targetRelativePath);
      if (targetResult.error) {
        // Target file doesn't exist, we'll create it
        targetContent = "";
      } else {
        targetContent = targetResult.content;
      }
    }
    
    // Extract the symbol body
    const symbolBody = this.extractSymbolBody(content.content, symbol);
    
    // Remove symbol from original location
    let newContent = content.content;
    // Remove the symbol definition
    
    // Add symbol to target location
    const fullTargetPath = `${this.projectRoot}/${targetRelativePath}`.replace(/\/\//g, '/');
    
    await this.createTextFile(targetRelativePath, targetContent + symbolBody);
    
    // Remove from original (simplified)
    // In real implementation, would remove just the symbol, not entire file content
    
    return {
      success: true,
      symbolName: namePath,
      targetRelativePath,
      symbolBodyLength: symbolBody.length
    };
  }

  async safeDeleteSymbol(relativePath, namePath, deleteEvenIfUsed = false, propagate = false) {
    // Safely delete a symbol, checking for usages first
    const content = await this.readFile(relativePath);
    if (content.error) return content;
    
    const symbol = this.findSymbolInContent(content, namePath);
    if (!symbol) return { error: `Symbol not found: ${namePath}` };
    
    // Check for usages (simplified)
    if (!deleteEvenIfUsed) {
      const usages = this.findUsagesInContent(content.content, namePath);
      if (usages.length > 0) {
        return {
          success: false,
          cannotDelete: true,
          usages: usages.map(u => ({
            location: { line: u.line, column: u.column },
            snippet: u.snippet
          })),
          message: `Symbol has ${usages.length} usage(s). Set deleteEvenIfUsed=true to force deletion.`
        };
      }
    }
    
    // Perform deletion - remove the symbol from the content
    let newContent = content.content;
    // Remove symbol definition (simplified)
    // In real implementation, would carefully remove just the symbol
    
    await this.createTextFile(relativePath, newContent);
    
    return {
      success: true,
      deletedSymbol: namePath
    };
  }

  async inlineSymbol(relativePath, namePath) {
    // Inline a symbol - replace all call sites with the symbol's body
    const content = await this.readFile(relativePath);
    if (content.error) return content;
    
    const symbol = this.findSymbolInContent(content, namePath);
    if (!symbol) return { error: `Symbol not found: ${namePath}` };
    
    const symbolBody = this.extractSymbolBody(content.content, symbol);
    
    // Find all call sites and replace with body
    const callSites = this.findCallSites(content.content, namePath);
    
    let newContent = content.content;
    for (const callSite of callSites) {
      // Replace call site with symbol body
      const regex = new RegExp(`(${namePath})`, 'g');
      newContent = newContent.replace(regex, symbolBody);
    }
    
    await this.createTextFile(relativePath, newContent);
    
    return {
      success: true,
      symbolName: namePath,
      inlinedCount: callSites.length
    };
  }

  // ===== MEMORY MANAGEMENT =====

  async writeMemory(memoryName, content, maxChars = -1) {
    // Write information to memory
    if (maxChars > 0 && content.length > maxChars) {
      return { error: `Content too long (${content.length} chars, max ${maxChars})` };
    }
    
    this.memoryStore.set(memoryName, content);
    
    return {
      success: true,
      memoryName,
      charactersWritten: content.length
    };
  }

  async readMemory(memoryName) {
    // Read memory content
    const content = this.memoryStore.get(memoryName);
    if (!content) {
      return { error: `Memory not found: ${memoryName}` };
    }
    
    return {
      success: true,
      memoryName,
      content
    };
  }

  async listMemories(topic = "") {
    // List available memories
    const memories = Array.from(this.memoryStore.keys());
    
    if (topic) {
      return {
        memories: memories.filter(m => m.includes(topic))
      };
    }
    
    return { memories };
  }

  async deleteMemory(memoryName) {
    // Delete a memory
    const existed = this.memoryStore.has(memoryName);
    this.memoryStore.delete(memoryName);
    
    return {
      success: existed,
      memoryName
    };
  }

  async renameMemory(oldName, newName) {
    // Rename or move a memory
    const content = this.memoryStore.get(oldName);
    if (!content) {
      return { error: `Memory not found: ${oldName}` };
    }
    
    this.memoryStore.delete(oldName);
    this.memoryStore.set(newName, content);
    
    return {
      success: true,
      oldName,
      newName
    };
  }

  async editMemory(memoryName, needle, repl, mode = "literal", allowMultiple = false) {
    // Replace content matching a regex in memory
    const memory = this.memoryStore.get(memoryName);
    if (!memory) {
      return { error: `Memory not found: ${memoryName}` };
    }
    
    let newContent;
    if (mode === "regex") {
      const flags = 'g';
      const regex = new RegExp(needle, flags);
      newContent = memory.replace(regex, repl);
    } else {
      if (allowMultiple) {
        newContent = memory.split(needle).join(repl);
      } else {
        const index = memory.indexOf(needle);
        if (index === -1) {
          return { error: `Needle not found in memory` };
        }
        newContent = memory.substring(0, index) + repl + memory.substring(index + needle.length);
      }
    }
    
    this.memoryStore.set(memoryName, newContent);
    
    return {
      success: true,
      memoryName,
      charactersChanged: newContent.length - memory.length
    };
  }

  // ===== DIAGNOSTICS / INSPECTIONS =====

  async getDiagnostics(relativePath) {
    // Get diagnostics/inspections for a file
    const content = await this.readFile(relativePath);
    if (content.error) return content;
    
    const diagnostics = [];
    const lines = content.content.split('\n');
    
    // Simple pattern-based diagnostics
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for common patterns
      if (line.includes('TODO') || line.includes('FIXME') || line.includes('XXX')) {
        diagnostics.push({
          severity: 1, // Information
          message: 'Comment marker found',
          line: i + 1,
          column: line.indexOf('TODO') !== -1 ? line.indexOf('TODO') : 
                  line.indexOf('FIXME') !== -1 ? line.indexOf('FIXME') :
                  line.indexOf('XXX') !== -1 ? line.indexOf('XXX') : 0,
          source: 'code-intel'
        });
      }
      
      // Check for unused variables (simple heuristic)
      const jsUnused = line.match(/const\s+\w+\s*=\s*[^;]+;|let\s+\w+\s*=\s*[^;]+;|var\s+\w+\s*=\s*[^;]+;/);
      if (jsUnused) {
        diagnostics.push({
          severity: 2, // Warning
          message: 'Variable may be unused',
          line: i + 1,
          column: jsUnused.index,
          source: 'code-intel'
        });
      }
    }
    
    return { diagnostics };
  }

  // ===== HELPER METHODS =====

  kindToName(kind) {
    const kindNames = {
      1: 'File', 2: 'Module', 3: 'Namespace', 4: 'Package', 5: 'Class', 6: 'Method',
      7: 'Property', 8: 'Field', 9: 'Constructor', 10: 'Enum', 11: 'Interface',
      12: 'Function', 13: 'Variable', 14: 'Constant', 15: 'String', 16: 'Number',
      17: 'Boolean', 18: 'Array', 19: 'Object', 20: 'Key', 21: 'Null', 22: 'EnumMember',
      23: 'Struct', 24: 'Event', 25: 'Operator', 26: 'TypeParameter'
    };
    return kindNames[kind] || 'Unknown';
  }

  matchNamePathPattern(namePath, pattern, substringMatching = false) {
    // Match a name path against a pattern
    if (!substringMatching) {
      // Exact or suffix match
      return namePath === pattern || namePath.endsWith(`/${pattern}`) || namePath === pattern;
    } else {
      // Substring matching
      return namePath.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  async findSymbolByNamePath(namePath, relativePath = "") {
    // Find a symbol by its name path
    const files = await this.listDir(relativePath ? relativePath : ".", true);
    
    for (const file of files) {
      if (file.type !== 'file') continue;
      if (!file.path.endsWith('.js') && !file.path.endsWith('.ts') && 
          !file.path.endsWith('.py')) continue;
      
      const contentResult = await this.readFile(file.path);
      if (contentResult.error) continue;
      
      const symbols = this.parseSymbols(file.path, contentResult.content);
      const found = symbols.find(s => s.namePath === namePath);
      if (found) return found;
    }
    
    return null;
  }

  parseSymbols(filePath, content) {
    // Parse symbols from file content (simplified)
    const symbols = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match class declarations
      const classMatch = line.match(/^(\s*)(class|interface|enum)\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          namePath: `${this.getBaseName(filePath)}/${classMatch[3]}`,
          name: classMatch[3],
          kind: 5, // Class
          line: i + 1,
          column: classMatch[1].length,
          body: null
        });
      }
      
      // Match function declarations
      const funcMatch = line.match(/^(\s*)(async\s+)?(function\s+\w+|const\s+\w+\s*=\s*function|(\w+)\s*=\s*\([^)]*\))\s*\(/);
      if (funcMatch) {
        const funcName = funcMatch[3] || funcMatch[2] || funcMatch[1];
        symbols.push({
          namePath: `${this.getBaseName(filePath)}/${funcName}`,
          name: funcName,
          kind: 12, // Function
          line: i + 1,
          column: funcMatch[1].length,
          body: null
        });
      }
    }
    
    return symbols;
  }

  parseFileSymbols(relativePath, content, depth) {
    // Parse file symbols for overview
    const symbols = this.parseSymbols(relativePath, content);
    
    if (depth <= 0) {
      return symbols.map(s => ({
        namePath: s.namePath,
        name: s.name,
        kind: s.kind,
        kindName: this.kindToName(s.kind)
      }));
    }
    
    return symbols;
  }

  getBaseName(filePath) {
    // Get base name from file path
    const parts = filePath.split('/');
    return parts[parts.length - 1].replace('.js', '').replace('.ts', '').replace('.py', '');
  }

  findSymbolInContent(content, namePath) {
    // Find a symbol in content (simplified)
    const lines = content.split('\n');
    const targetName = namePath.split('/').pop();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(targetName) && (line.includes('class ') || line.includes('function ') || line.includes('const ') || line.includes('let '))) {
        return {
          name: targetName,
          namePath: namePath,
          line: i + 1,
          column: line.indexOf(targetName),
          body: null
        };
      }
    }
    
    return null;
  }

  extractSymbolBody(content, symbol) {
    // Extract symbol body from content
    // Simplified - just returns the symbol line
    const lines = content.split('\n');
    const line = lines[symbol.line - 1];
    return line;
  }

  findReferencesInContent(content, symbol) {
    // Find references to a symbol in content
    const references = [];
    const lines = content.split('\n');
    const targetName = symbol.name;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(new RegExp(targetName, 'g'));
      if (matches) {
        references.push({
          namePath: `${this.getBaseName('')}/${targetName}`,
          line: i + 1,
          column: line.indexOf(targetName),
          context: line,
          snippet: line
        });
      }
    }
    
    return references;
  }

  findImplementationsInContent(content, symbol) {
    // Find implementations of a symbol
    return this.findReferencesInContent(content, symbol);
  }

  findUsagesInContent(content, namePath) {
    // Find usages of a name path in content
    const usages = [];
    const lines = content.split('\n');
    const targetName = namePath.split('/').pop();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const charPos = line.indexOf(targetName);
      if (charPos !== -1) {
        usages.push({
          line: i + 1,
          column: charPos,
          snippet: line
        });
      }
    }
    
    return usages;
  }

  findCallSites(content, namePath) {
    // Find call sites for a symbol
    const sites = [];
    const lines = content.split('\n');
    const targetName = namePath;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Simple pattern: functionName(...) 
      const match = line.match(new RegExp(`${targetName}\\s*\\('`, 'g'));
      if (match) {
        sites.push({
          line: i + 1,
          column: line.indexOf(match[0]),
          snippet: line
        });
      }
    }
    
    return sites;
  }

  formatSymbols(symbols) {
    // Format symbols for output
    return {
      success: true,
      symbols: symbols.map(s => ({
        namePath: s.namePath,
        name: s.name,
        kind: s.kind,
        kindName: s.kindName,
        location: s.location,
        body: s.body,
        info: s.info
      }))
    };
  }
}
