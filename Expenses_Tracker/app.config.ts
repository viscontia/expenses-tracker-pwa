import { createApp } from 'vinxi'
import reactRefresh from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { config } from 'vinxi/plugins/config'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production']).default('development'),
	DATABASE_URL: z.string().min(1),
	ADMIN_PASSWORD: z.string().min(1),
	JWT_SECRET: z.string().min(1),
	BASE_URL: z.string().min(1).optional(),
})

const env = envSchema.parse(process.env)

export default createApp({
	server: {
		preset: 'netlify',
		experimental: {
			asyncContext: true,
		},
	},
	routers: [
		{
			type: 'static',
			name: 'public',
			dir: './public',
		},
		{
			type: 'http',
			name: 'trpc',
			base: '/api/trpc',
			handler: './src/server/trpc/handler.ts',
			target: 'server',
			plugins: () => [
				config('allowedHosts', {
					// @ts-ignore
					server: {
						allowedHosts: env.BASE_URL
							? [env.BASE_URL.split('://')[1]]
							: undefined,
					},
				}),
				tsConfigPaths({
					projects: ['./tsconfig.json'],
				}),
				nodePolyfills(),
			],
		},
		{
			type: 'spa',
			name: 'client',
			handler: './index.html',
			target: 'browser',
			plugins: () => [
				config('allowedHosts', {
					// @ts-ignore
					server: {
						allowedHosts: env.BASE_URL
							? [env.BASE_URL.split('://')[1]]
							: undefined,
					},
				}),
				tsConfigPaths({
					projects: ['./tsconfig.json'],
				}),
				TanStackRouterVite({
					target: 'react',
					autoCodeSplitting: true,
					routesDirectory: './src/routes',
					generatedRouteTree:
						'./src/generated/tanstack-router/routeTree.gen.ts',
				}),
				reactRefresh(),
				nodePolyfills(),
			],
		},
	],
})
