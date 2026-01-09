declare module 'hdb' {
	type Callback<T> = (err: unknown, value: T) => void;

	export interface ClientOptions {
		host?: string;
		port?: number;
		user?: string;
		password?: string;
		databaseName?: string;
		useTLS?: boolean;
		rejectUnauthorized?: boolean;
		[key: string]: unknown;
	}

	export interface Statement {
		exec(params: unknown[] | Record<string, unknown>, cb: Callback<unknown[]>): void;
		drop(cb?: (err?: unknown) => void): void;
	}

	export interface Client {
		connect(cb: (err?: unknown) => void): void;
		end(): void;
		exec(sql: string, cb: Callback<unknown[]>): void;
		prepare(sql: string, cb: Callback<Statement>): void;
		on(event: 'error', cb: (err: unknown) => void): void;
	}

	export default {
		createClient(options: ClientOptions): Client;
	};
}

