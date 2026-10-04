const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../../');

describe('STORM-001: Repository Architecture & Baseline Configs', () => {
  it('should have a valid .gitignore file ignoring sensitive and build files', () => {
    const gitignorePath = path.join(ROOT_DIR, '.gitignore');
    assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist in root');

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const requiredPatterns = [
      'node_modules/',
      '.env',
      'coverage/',
      'dist/',
      '*.log',
      '.DS_Store'
    ];

    for (const pattern of requiredPatterns) {
      assert.ok(
        content.includes(pattern),
        `.gitignore must include ignore pattern: "${pattern}"`
      );
    }
  });

  it('should have a valid .editorconfig file with correct indentation and line endings', () => {
    const editorconfigPath = path.join(ROOT_DIR, '.editorconfig');
    assert.ok(fs.existsSync(editorconfigPath), '.editorconfig must exist in root');

    const content = fs.readFileSync(editorconfigPath, 'utf-8');
    assert.ok(content.includes('indent_size = 2'), 'EditorConfig must specify indent_size = 2');
    assert.ok(content.includes('indent_style = space'), 'EditorConfig must specify indent_style = space');
    assert.ok(content.includes('end_of_line = lf'), 'EditorConfig must specify end_of_line = lf');
    assert.ok(content.includes('charset = utf-8'), 'EditorConfig must specify charset = utf-8');
  });

  it('should have a valid package.json with required metadata and test script', () => {
    const packageJsonPath = path.join(ROOT_DIR, 'package.json');
    assert.ok(fs.existsSync(packageJsonPath), 'package.json must exist in root');

    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    let pkg;
    assert.doesNotThrow(() => {
      pkg = JSON.parse(content);
    }, 'package.json must be valid JSON');

    assert.equal(pkg.name, 'stackstorm-backend', 'Package name must be stackstorm-backend');
    assert.ok(pkg.scripts && pkg.scripts.test, 'package.json must define a test script');
    assert.ok(pkg.author, 'package.json must specify authors');
    assert.equal(pkg.private, true, 'package.json must be private');
  });

  it('should have a comprehensive README.md with project details and student credits', () => {
    const readmePath = path.join(ROOT_DIR, 'README.md');
    assert.ok(fs.existsSync(readmePath), 'README.md must exist in root');

    const content = fs.readFileSync(readmePath, 'utf-8');
    assert.ok(content.includes('Dickwella Fashion Corner'), 'README must mention client Dickwella Fashion Corner');
    assert.ok(content.includes('Amarawickrama R.H.'), 'README must credit Amarawickrama R.H.');
    assert.ok(content.includes('S. Thanoogithan'), 'README must credit S. Thanoogithan');
    assert.ok(content.includes('B.K. Pabasara'), 'README must credit B.K. Pabasara');
    assert.ok(content.includes('Lakshani A.T.'), 'README must credit Lakshani A.T.');
    assert.ok(content.includes('stackstorm-backend'), 'README must describe stackstorm-backend repository');
  });

  it('should have a .gitattributes file enforcing LF line endings', () => {
    const gitattributesPath = path.join(ROOT_DIR, '.gitattributes');
    assert.ok(fs.existsSync(gitattributesPath), '.gitattributes must exist in root');

    const content = fs.readFileSync(gitattributesPath, 'utf-8');
    assert.ok(content.includes('eol=lf'), '.gitattributes must enforce eol=lf');
  });
});
