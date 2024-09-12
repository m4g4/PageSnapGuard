import path from "path";
import fs from 'fs';

export async function removeDirFiles(dirPath: string) {
    fs.readdir(dirPath, (err, files) => {
        if (err) throw err;
      
        for (const file of files) {
            fs.unlink(path.join(dirPath, file), (err) => {
                if (err) throw err;
            });
        }
    });
}

export function prepareOutputDir(dirPath: string) {
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
    }
}