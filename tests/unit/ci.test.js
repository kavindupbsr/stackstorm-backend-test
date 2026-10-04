const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');

describe('STORM-005: ESLint, Prettier & CI/CD Pipeline Verification', () => {
  it('should have required scripts in package.json for linting, formatting, and testing', () => {
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts).toHaveProperty('lint');
    expect(pkg.scripts).toHaveProperty('lint:fix');
    expect(pkg.scripts).toHaveProperty('format');
    expect(pkg.scripts).toHaveProperty('format:check');
    expect(pkg.scripts).toHaveProperty('test');
  });

  it('should have a valid .eslintrc.json extending airbnb-base and prettier', () => {
    const eslintPath = path.join(ROOT_DIR, '.eslintrc.json');
    expect(fs.existsSync(eslintPath)).toBe(true);

    const eslintConfig = JSON.parse(fs.readFileSync(eslintPath, 'utf-8'));
    expect(eslintConfig.extends).toContain('airbnb-base');
    expect(eslintConfig.extends).toContain('prettier');
    expect(eslintConfig.env).toHaveProperty('node', true);
    expect(eslintConfig.env).toHaveProperty('jest', true);
  });

  it('should have a valid .prettierrc specifying 2 spaces and single quotes', () => {
    const prettierPath = path.join(ROOT_DIR, '.prettierrc');
    expect(fs.existsSync(prettierPath)).toBe(true);

    const prettierConfig = JSON.parse(fs.readFileSync(prettierPath, 'utf-8'));
    expect(prettierConfig.tabWidth).toBe(2);
    expect(prettierConfig.singleQuote).toBe(true);
    expect(prettierConfig.semi).toBe(true);
  });

  it('should have a valid GitHub Actions CI workflow in .github/workflows/ci.yml', () => {
    const ciPath = path.join(ROOT_DIR, '.github', 'workflows', 'ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);

    const content = fs.readFileSync(ciPath, 'utf-8');
    expect(content).toContain('node-version: 20');
    expect(content).toContain('postgres:17-alpine');
    expect(content).toContain('redis:7-alpine');
    expect(content).toContain('npm run lint');
    expect(content).toContain('npm run format:check');
    expect(content).toContain('npm test');
  });
});
