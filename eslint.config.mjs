import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        ignores: [
            'admin/**/*',
            'node_modules/**/*',
            'test/**/*',
            'build/**/*',
            'tmp/**/*',
            '.**/*',
            // Have their own TypeScript projects and toolchains, see `npm run check:widgets`, `check:devices`, `check:wc`
            'src-widgets/**/*',
            'src-devices/**/*',
            'src-webcomponents/**/*',
            'src-shared/**/*',
            'widgets/**/*',
            'tasks.ts',
        ],
    },
    {
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',

            '@typescript-eslint/no-require-imports': 'off',
        },
    },
];
