import { Component } from '@angular/core';
import * as zip from '@zip.js/zip.js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  stuff: any[] = []
  downloadUri = '';

  async createNew() {
    const http = new zip.HttpReader('https://cors.thelista.co/https://nimdepcomapp.blob.core.windows.net/public/template.nupkg');
    const zipReader = new zip.ZipReader(http);
    const dirHandle = await window.showDirectoryPicker();
    
    const entries = await zipReader.getEntries();

    for (let entry of entries) {
      const fileHandle = await this.recursiveGetFileHandle(dirHandle, entry.filename, { create: true });
      const writable = await fileHandle.createWritable();
      await entry.getData?.(writable, { onprogress: async (current) => {
        console.log(`Reading ${current} bytes`);
      }});
    }
  }

  async downloadZip() {
    const fsZip = new zip.fs.FS();
    const dirHandle = await window.showDirectoryPicker();

    for await (const path of getAllFilePaths(dirHandle)) {
      const fileHandle = await this.recursiveGetFileHandle(dirHandle, path);
      const file = await fileHandle.getFile();
      fsZip.addReadable(path, file.stream());
    }

    const outputFileHandle = await dirHandle.getFileHandle('test.nupkg', {
      create: true,
    });

    const outputFileWritable = await outputFileHandle.createWritable();

    await fsZip.exportWritable(outputFileWritable, {
      level: 9,
      onstart: async (_) => console.log('started'),
      onend: async (_) => console.log('done'),
      onprogress: async (progress) => console.log(`progress: ${progress}`),
    });
  }

  async recursiveGetFileHandle(
    dirHandle: FileSystemDirectoryHandle,
    filePath: string,
    options: FileSystemGetFileOptions = {},
  ): Promise<FileSystemFileHandle> {
    if (filePath.includes('/')) {
      const currentDirName = filePath.split('/')[0];
      const currentDirHandle = await dirHandle.getDirectoryHandle(
        currentDirName,
        options
      );
      return await this.recursiveGetFileHandle(
        currentDirHandle,
        filePath.slice(currentDirName.length + 1),
        options,
      );
    } else {
      return await dirHandle.getFileHandle(filePath, options);
    }
  }
}

async function* getAllFilePaths(
  dirHandle: FileSystemDirectoryHandle,
  currentPath = ''
): AsyncGenerator<string> {
  const entries = dirHandle.entries();

  for await (let entry of entries) {
    const [name, handle] = entry;
    if (handle.kind === 'directory') {
      for await (const path of getAllFilePaths(
        handle,
        `${currentPath}/${name}`
      )) {
        yield path;
      }
    } else {
      const file = await handle.getFile();
      const path = `${currentPath}/${file.name}`;
      yield path.slice(path.startsWith('/') ? 1 : 0);
    }
  }
}
