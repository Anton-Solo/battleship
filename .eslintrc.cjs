/** @type {import('eslint').Linter.Config} */
module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 'latest',
	},
	plugins: ['@typescript-eslint'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
	env: {
		node: true,
		es2022: true,
	},
	ignorePatterns: ['front/**', 'node_modules/**', 'dist/**'],
	rules: {
		'@typescript-eslint/no-explicit-any': 'off',
	},
};


