import { EventBus, EventBusMessage } from "./EventBus";

export type AccomplishmentMessage = EventBusMessage<AccomplishmentPayload>;

export const skillCategories = ["reading", "listening", "speaking", "writing", "learning", "community"] as const;

export interface AccomplishmentPayload {
  skillCategory: (typeof skillCategories)[number];
  /*
  what is the accomplishment? e.g. chapter, flashcard, story, etc.
  only one keyword per skill category, written in lowercase without spaces, numbers, or special characters
  */
  accomplishmentKeyword: string;
  // the human readable description of the accomplishment. Important for other plugin developers to understand the accomplishment.
  description: string;
  durationMinutes?: number;
  meta?: {
    //the key of the meta data in snake_case
    key: string;
    //the value of the meta data
    value: string | number | boolean;
    //the human readable description of the meta data. Important for other plugin developers to understand the meta data.
    description: string;
  }[];
}

export class AccomplishmentHandler {
  private pluginId: string;

  public constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  emitAccomplishment(payload: AccomplishmentPayload) {
    this.validateAccomplishment(payload);

    const sanitizedPayload = this.sanitizeAccomplishment(payload);

    EventBus.emit(this.pluginId, "global.accomplishment.triggerMicro", sanitizedPayload);
  }

  private validateAccomplishment(payload: AccomplishmentPayload) {
    if (!skillCategories.includes(payload.skillCategory)) {
      throw new Error(`Invalid skill category: ${payload.skillCategory}`);
    }

    //regex validate accomplishmentKeyword
    if (!/^[a-z]+$/.test(payload.accomplishmentKeyword)) {
      throw new Error(`Invalid accomplishment keyword: ${payload.accomplishmentKeyword}`);
    }

    //description is required
    if (payload.description.length < 10) {
      throw new Error("Description is too short");
    }


    //durationMinutes is required
    if (payload.durationMinutes && payload.durationMinutes < 0.5) {
      throw new Error("The duration must be at least 0.5 minute");
    }

    //regex check meta data key
    if (payload.meta && payload.meta.some((meta) => !/^[a-z_]+$/.test(meta.key))) {
      throw new Error("Invalid meta data key");
    }
  }

  private sanitizeAccomplishment(payload: AccomplishmentPayload) {
    payload.description = payload.description.replace(/[^\x20-\x7E]/g, "");

    payload.meta?.forEach((meta) => {
      meta.description = meta.description.replace(/[^\x20-\x7E]/g, "");
    });

    return payload;
  }

  private getAccomplishmentTopic(payload: AccomplishmentPayload) {
    return `${this.pluginId}.${payload.skillCategory}.${payload.accomplishmentKeyword}`;
  }

  private getDecoupledTopic(topic: string) {
    const [plugin, skillCategory, accomplishmentKeyword] = topic.split(".");

    return { plugin: plugin || "*", skillCategory: skillCategory || "*", accomplishmentKeyword: accomplishmentKeyword || "*" };
  }

  /**
   * Subscribe to accomplishment events
   * @param accomplishmentTopic - The topic of the accomplishment event. The pattern can be any pattern of plugin.skillCategory.accomplishmentKeyword or an * as wildcard for any plugin, skill category or accomplishment keyword
   * @param callback - The callback function to be called when the accomplishment event is triggered
   */
  subscribe(accomplishmentTopics = "*" as string | string[], callback: (payload: EventBusMessage<AccomplishmentPayload>) => void) {
    if (typeof accomplishmentTopics === "string") {
      accomplishmentTopics = [accomplishmentTopics];
    }

    accomplishmentTopics.forEach((accomplishmentTopic) => {
      const topicLength = accomplishmentTopic.split(".").length
      if (topicLength === 1) {
        accomplishmentTopic += ".*.*"
      } else if (topicLength === 2) {
        accomplishmentTopic += ".*"
      } else if (topicLength !== 3) {
        throw new Error("Invalid accomplishment topic pattern. The pattern must be plugin.skillCategory.accomplishmentKeyword or an * as wildcard for any plugin, skill category or accomplishment keyword");
      }

      EventBus.on<AccomplishmentPayload>("global.accomplishment.triggerMicro", (event) => {
        const { plugin, skillCategory, accomplishmentKeyword } = this.getDecoupledTopic(accomplishmentTopic);

        if (plugin !== "*" && event.sender !== plugin) return;
        if (skillCategory !== "*" && event.data.skillCategory !== skillCategory) return;
        if (accomplishmentKeyword !== "*" && event.data.accomplishmentKeyword !== accomplishmentKeyword) return;

        callback(event);
      }, [this.pluginId]);
    });
  }
}

// const accomplishmentHandler = AccomplishmentHandler.getInstance("my-plugin");

// accomplishmentHandler.subscribe("*", (payload) => {
//   console.log(payload);
// });

// accomplishmentHandler.emitAccomplishment({
//   skillCategory: "reading",
//   accomplishmentKeyword: "chapter",
//   description: "Read chapter 1 of the book",
//   durationMinutes: 10,
//   meta: [
//     {
//       key: "book",
//       value: "The Great Gatsby",
//       description: "The book I read",
//     },
//   ],
// });
