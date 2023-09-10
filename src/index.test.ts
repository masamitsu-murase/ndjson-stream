import { expect, jest, test, describe } from '@jest/globals';
import { NdjsonStream, LineBreakerStream, JsonParserStream } from "./index";
// import {NdjsonStream, LineBreakerStream, JsonParserStream } from "../dist/index";


class SimpleReadableStream<T> extends ReadableStream<T>
{
    constructor(dataList: Iterable<T>) {
        const source = {
            start(controller: ReadableStreamDefaultController<T>) {
                for (const data of dataList) {
                    controller.enqueue(data);
                }
                controller.close();
            }
        };
        super(source);
    }
}

async function verifyReadableStream<T>(expected: Array<T>, stream: ReadableStreamDefaultReader<T>): Promise<void> {
    while (true) {
        const { done, value } = await stream.read();
        if (done) {
            expect(expected.length).toBe(0);
            return;
        }

        expect(value).toStrictEqual(expected.shift());
    }
}

describe("LineBreakStream", () => {
    const inputListPatterns = [
        ["", "a", "bc", "\n", "日本語\ndef", "\r\ne", "nd\n", ""],
        ["abc\n", "日本語\ndef\r\n", "end\n"],
        ["", "", "abc\n日本語\ndef\r\nend\n", "", ""],
        ["abc\n日本語\nd", "ef\r\nend", "\n"],
    ];
    for (const inputList of inputListPatterns) {
        const title = inputList.join("|").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
        test(`Split test into lines: ${title}`, async () => {
            const expected = ["abc", "日本語", "def\r", "end"];
            const chained = new SimpleReadableStream<string>(inputList).pipeThrough(new LineBreakerStream()).getReader();

            await verifyReadableStream(expected, chained);
        });
    };

    test(`Split test into lines including empty line`, async () => {
        const inputList = ["\nabc\nd", "ef\r", "\n\n", "end\n\r\n"];
        const expected = ["", "abc", "def\r", "", "end", "\r"];
        const chained = new SimpleReadableStream<string>(inputList).pipeThrough(new LineBreakerStream()).getReader();

        await verifyReadableStream(expected, chained);
    });
});

describe("JsonParseStream", () => {
    test("IgnoreEmptyLine: true", async () => {
        const streams = [
            new JsonParserStream<object>(),
            new JsonParserStream<object>(true),
        ];
        for (const stream of streams) {
            const inputList = [
                '{"abc":123}',
                '',
                '',
                '{"def": 456, "ghi": 789}',
                '\r',
                '',
            ];
            const expected = [
                { "abc": 123 },
                { "def": 456, "ghi": 789 },
            ];
            const chained = new SimpleReadableStream<string>(inputList).pipeThrough(stream).getReader();

            await verifyReadableStream(expected, chained);
        }
    });

    const invalidInputListPatterns = [
        ['{"abc":123}', ''],
        ['{"abc":123}', '\r'],
    ];
    for (const inputList of invalidInputListPatterns) {
        const title = inputList.join('|').replace(/\r/g, "\\r");
        test(`IgnoreEmptyLine: false: inputList=${title}`, async () => {
            const expected = [
                { "abc": 123 },
            ];
            const chained = new SimpleReadableStream<string>(inputList).pipeThrough(new JsonParserStream<object>(false)).getReader();

            await expect(() => verifyReadableStream(expected, chained)).rejects.toThrowError();
        });
    }
});

describe("NdjsonStream", () => {
    test("ignoreEmptyLine: true", async () => {
        const streams = [
            new NdjsonStream(),
            new NdjsonStream(true),
        ];
        for (const ndjsonStream of streams) {
            const input = '{"abc": 123}\r\n\r\n{"def": 456}\n'
            const expected = [
                { "abc": 123 },
                { "def": 456 },
            ];
            const stream = new Blob([input]).stream();
            const chained = stream.pipeThrough(ndjsonStream).getReader();

            await verifyReadableStream(expected, chained);
        }
    });

    test("ignoreEmptyLine: false", async () => {
        const input = '{"abc": 123}\r\n\r\n{"def": 456}\n';
        const expected = [
            { "abc": 123 },
            { "def": 456 },
        ];
        const stream = new Blob([input]).stream();
        const chained = stream.pipeThrough(new NdjsonStream(false)).getReader();

        await expect(() => verifyReadableStream(expected, chained)).rejects.toThrowError();
    });

    test("check type inference", async () => {
        interface KeyValue {
            key: number;
        }

        const Transformer = class extends TransformStream<KeyValue, number> {
            constructor() {
                super({
                    transform(chunk, controller) {
                        controller.enqueue(chunk.key);
                    }
                });
            }
        };

        const input = '{"key": 123}\n{"key": 456}\n';
        const expected = [
            123,
            456,
        ];
        const stream = new Blob([input]).stream();
        const chained = stream.pipeThrough(new NdjsonStream()).pipeThrough(new Transformer()).getReader();

        await verifyReadableStream(expected, chained);
    });
});
