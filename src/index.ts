
class LineBreakerTransformer {
    processing: string = "";

    constructor() {
        this.processing = "";
    }

    start(controller: TransformStreamDefaultController<string>) {
        this.processing = "";
    }

    transform(chunk: string, controller: TransformStreamDefaultController<string>) {
        const [first, ...others] = chunk.split("\n");
        const firstLine = this.processing + first;

        switch (others.length) {
            case 0:
                this.processing = firstLine;
                break;
            case 1:
                controller.enqueue(firstLine);
                this.processing = others[0];
                break;
            default: {
                controller.enqueue(firstLine);
                const last = others.pop() as string;
                for (const line of others) {
                    controller.enqueue(line);
                }
                this.processing = last;
                break;
            }
        }
    }

    flush(controller: TransformStreamDefaultController<string>) {
        // TODO: Should raise an error?
        if (this.processing !== "") {
            controller.enqueue(this.processing);
        }
    }
}

class LineBreakerStream extends TransformStream<string, string>
{
    constructor() {
        super(new LineBreakerTransformer());
    }
}

class JsonParserTransformer<T>
{
    ignoreEmptyLine: boolean;

    constructor(ignoreEmptyLine: boolean) {
        this.ignoreEmptyLine = ignoreEmptyLine;
    }

    transform(chunk: string, controller: TransformStreamDefaultController<T>) {
        if (this.ignoreEmptyLine && (chunk === "" || chunk === "\r")) {
            return;
        }

        try {
            const value = JSON.parse(chunk) as T;
            controller.enqueue(value);
        } catch (e) {
            controller.error(e);
        }
    }
}

class JsonParserStream<T> extends TransformStream<string, T>
{
    constructor(ignoreEmptyLine: boolean = true) {
        super(new JsonParserTransformer<T>(ignoreEmptyLine));
    }
}

class NdjsonStream<T> implements TransformStream<Uint8Array, T>
{
    readable: ReadableStream<T>;
    writable: WritableStream<Uint8Array>;

    constructor(ignoreEmptyLine: boolean = true) {
        const root = new TextDecoderStream();
        const chained = root.readable.pipeThrough(new LineBreakerStream()).pipeThrough(new JsonParserStream<T>(ignoreEmptyLine));
        this.readable = chained;
        this.writable = root.writable;
    }
}

export { NdjsonStream, JsonParserStream, LineBreakerStream };
