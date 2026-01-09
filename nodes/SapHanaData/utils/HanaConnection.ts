import type { ICredentialDataDecryptedObject } from 'n8n-workflow';
import hdb from 'hdb';

export interface HanaConnectionConfig {
	host: string;
	port: number;
	username: string;
	password: string;
	databaseName?: string;
	useTLS?: boolean;
	validateCertificate?: boolean;
	connectTimeoutMs?: number;
	currentSchema?: string;
}

export class HanaDataClient {
	private client: any;
	private config: HanaConnectionConfig;

	constructor(credentials: ICredentialDataDecryptedObject) {
		this.config = {
			host: credentials.host as string,
			port: credentials.port as number,
			username: credentials.username as string,
			password: credentials.password as string,
			databaseName: credentials.database as string,
			useTLS: (credentials.encrypt as boolean) ?? true,
			validateCertificate: (credentials.validateCertificate as boolean) ?? true,
			connectTimeoutMs: (credentials.connectTimeout as number) ?? 15000,
			currentSchema: credentials.currentSchema as string,
		};
	}

	async connect(): Promise<void> {
		const connectOptions: Record<string, unknown> = {
			host: this.config.host,
			port: this.config.port,
			user: this.config.username,
			password: this.config.password,
		};

		if (this.config.databaseName) {
			connectOptions.databaseName = this.config.databaseName;
		}

		if (this.config.useTLS) {
			connectOptions.useTLS = true;
		}

		if (this.config.validateCertificate === false) {
			connectOptions.rejectUnauthorized = false;
		}

		this.client = hdb.createClient(connectOptions);
		this.client.on('error', (err: any) => {
			console.warn('HANA network error:', err?.message ?? err);
		});

		await this.withTimeout(
			new Promise<void>((resolve, reject) => {
				this.client.connect((err: any) => {
					if (err) {
						reject(new Error(`HANA connection failed: ${err.message ?? err}`));
						return;
					}
					resolve();
				});
			}),
			this.config.connectTimeoutMs ?? 15000,
			'HANA connection timed out',
		);

		if (this.config.currentSchema) {
			await this.executeQuery(`SET SCHEMA ${this.config.currentSchema}`);
		}
	}

	async disconnect(): Promise<void> {
		if (this.client) {
			try {
				this.client.end();
			} catch (err: any) {
				console.warn('HANA disconnect warning:', err?.message ?? err);
			} finally {
				this.client = undefined;
			}
		}
	}

	async executeQuery(query: string, params: any[] = []): Promise<any[]> {
		if (!this.client) {
			throw new Error('HANA client is not connected');
		}

		if (!params.length) {
			return await new Promise((resolve, reject) => {
				this.client.exec(query, (err: any, result: any[]) => {
					if (err) {
						reject(new Error(`Query execution failed: ${err.message ?? err}`));
						return;
					}
					resolve(result ?? []);
				});
			});
		}

		const statement = await new Promise<any>((resolve, reject) => {
			this.client.prepare(query, (err: any, stmt: any) => {
				if (err) {
					reject(new Error(`Query preparation failed: ${err.message ?? err}`));
					return;
				}
				resolve(stmt);
			});
		});

		try {
			return await new Promise((resolve, reject) => {
				statement.exec(params, (err: any, result: any[]) => {
					if (err) {
						reject(new Error(`Query execution failed: ${err.message ?? err}`));
						return;
					}
					resolve(result ?? []);
				});
			});
		} finally {
			if (typeof statement.drop === 'function') {
				statement.drop();
			}
		}
	}

	// Data reading operations
	async getAllRecords(tableName: string, columns = '*'): Promise<any[]> {
		const query = `SELECT ${columns} FROM ${tableName}`;
		return await this.executeQuery(query);
	}

	async getFilteredRecords(
		tableName: string, 
		whereCondition: string, 
		columns = '*',
		orderBy?: string,
		limit?: number
	): Promise<any[]> {
		let query = `SELECT ${columns} FROM ${tableName} WHERE ${whereCondition}`;
		
		if (orderBy) {
			query += ` ORDER BY ${orderBy}`;
		}
		
		if (limit && limit > 0) {
			query += ` LIMIT ${limit}`;
		}
		
		return await this.executeQuery(query);
	}

	async executeCustomQuery(query: string, params: any[] = []): Promise<any[]> {
		return await this.executeQuery(query, params);
	}

	async testConnection(): Promise<boolean> {
		try {
			const result = await this.executeQuery('SELECT 1 as test FROM DUMMY');
			return result.length > 0;
		} catch (error) {
			return false;
		}
	}

	async getTableInfo(tableName: string): Promise<any[]> {
		const query = `
			SELECT COLUMN_NAME, DATA_TYPE_NAME, LENGTH, SCALE, IS_NULLABLE
			FROM TABLE_COLUMNS 
			WHERE SCHEMA_NAME = CURRENT_SCHEMA 
			AND TABLE_NAME = ?
			ORDER BY POSITION
		`;
		return await this.executeQuery(query, [tableName]);
	}

	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
		let timeoutHandle: NodeJS.Timeout | undefined;
		try {
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
			});

			return await Promise.race([promise, timeoutPromise]);
		} finally {
			if (timeoutHandle) clearTimeout(timeoutHandle);
		}
	}
}
