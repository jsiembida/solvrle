import terser from '@rollup/plugin-terser';
import eslint from '@rollup/plugin-eslint';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
	input: 'src/index.js',
	output: [
		{
			file: 'build/index.js',
			format: 'es'
		},
		{
			file: 'build/index.min.js',
			format: 'iife',
			plugins: [terser({
				mangle: {
					properties: {
						regex: /.+/,
					},
				},
			})]
		}
	],
	plugins: [eslint(), nodeResolve()]
};
