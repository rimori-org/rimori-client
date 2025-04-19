import { v4 as uuidv4 } from 'uuid';
import { ObjectRequest } from "./ObjectController";
import { RimoriClient } from "../plugin/RimoriClient";

export interface BasicAssignment {
    id: string;
    createdAt: Date;
    topic: string;
    createdBy: string;
    verified: boolean;
    keywords: any;
}

export class SharedContentController {
    private rimoriClient: RimoriClient;

    constructor(rimoriClient: RimoriClient) {
        this.rimoriClient = rimoriClient;
    }

    public async fetchNewSharedContent<T, R = T & BasicAssignment>(
        type: string,
        generatorInstructions: (reservedTopics: string[]) => Promise<ObjectRequest> | ObjectRequest,
        filter?: { column: string, value: string | number | boolean },
    ): Promise<R[]> {
        const queryParameter = { filter_column: filter?.column || null, filter_value: filter?.value || null, unread: true }
        const { data: newAssignments } = await this.rimoriClient.rpc(type + "_entries", queryParameter)
        console.log('newAssignments:', newAssignments);

        if ((newAssignments as any[]).length > 0) {
            return newAssignments as R[];
        }
        // generate new assignments
        const { data: oldAssignments } = await this.rimoriClient.rpc(type + "_entries", { ...queryParameter, unread: false })
        console.log('oldAssignments:', oldAssignments);
        const reservedTopics = this.getReservedTopics(oldAssignments as BasicAssignment[]);

        const request = await generatorInstructions(reservedTopics);
        if (!request.tool.keywords || !request.tool.topic) {
            throw new Error("topic or keywords not found in the request schema");
        }
        const instructions = await this.rimoriClient.generateObject(request);
        console.log('instructions:', instructions);

        const preparedData = {
            id: uuidv4(),
            ...instructions,
            keywords: this.purifyStringArray(instructions.keywords),
        };
        return await this.rimoriClient.from(type).insert(preparedData).then(() => [preparedData] as R[]);
    }

    private getReservedTopics(oldAssignments: BasicAssignment[]) {
        return oldAssignments.map(({ topic, keywords }) => {
            const keywordTexts = this.purifyStringArray(keywords).join(',');
            return `${topic}(${keywordTexts})`;
        });
    }

    private purifyStringArray(array: { text: string }[]): string[] {
        return array.map(({ text }) => text);
    }

    public async getSharedContent<T extends BasicAssignment>(type: string, id: string): Promise<T> {
        return await this.rimoriClient.from(type).select().eq('id', id).single() as unknown as T;
    }

    public async completeSharedContent(type: string, assignmentId: string) {
        await this.rimoriClient.from(type + "_result").insert({ assignment_id: assignmentId });
    }
}