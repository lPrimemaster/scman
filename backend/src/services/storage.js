import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

export function createStorage(uploadDir) {
	fs.mkdirSync(uploadDir, { recursive: true });

	return {
		dir: uploadDir,

		async save(readable, filename) {
			const filepath = path.join(uploadDir, filename);
			let size = 0;
			const counter = new Transform({
				transform(chunk, _, cb) {
					size += chunk.length;
					cb(null, chunk);
				}
			});

			try {
				await pipeline(readable, counter, fs.createWriteStream(filepath));
			} catch (err) {
				await fs.promises.rm(filepath, { force: true });
				throw err;
			}
			return { size };
		},

		// `dir` is the path stored with the file row (kept for older rows).
		async remove(dir, filename) {
			await fs.promises.rm(path.join(dir, filename), { force: true });
		},

		stream(dir, filename) {
			return fs.createReadStream(path.join(dir, filename));
		},

		exists(dir, filename) {
			return fs.existsSync(path.join(dir, filename));
		}
	};
}
