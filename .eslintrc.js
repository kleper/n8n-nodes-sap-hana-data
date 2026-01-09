module.exports = {
	root: true,
	env: {
		browser: false,
		es6: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: 'tsconfig.json',
		sourceType: 'module',
		ecmaVersion: 2019,
		extraFileExtensions: ['.json'],
	},
	plugins: ['@typescript-eslint'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:n8n-nodes-base/nodes',
	],
	rules: {
		'n8n-nodes-base/node-param-default-wrong-for-limit': 'off',
		'n8n-nodes-base/node-param-description-wrong-for-limit': 'off',
		'n8n-nodes-base/node-param-min-value-wrong-for-limit': 'off',
		'n8n-nodes-base/node-param-type-options-max-value-present': 'off',
	},
};
