# NDJSON Stream

This is a library to provide [TransformStream](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream) for [NDJSON](http://ndjson.org/).

## Usage

```typescript
import { NdjsonStream } from "ndjson-stream/index";

async function processStream<T>(stream: ReadableStreamDefaultReader<T>): Promise<void> {
    while (true) {
        const { done, value } = await stream.read();
        if (done) {
            return;
        }

        console.log(value);
    }
}

async function main(): Promise<void> {
    const ndjsonStream = new NdjsonStream();

    const input = '{"abc": 123}\r\n\r\n{"def": 456}\n';
    const stream = new Blob([input]).stream();
    const chained = stream.pipeThrough(ndjsonStream).getReader();
    await processStream(chained);
}
```
