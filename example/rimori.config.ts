import { RimoriPluginConfig } from "@rimori/client";

/**
 * This is an example of a Rimori plugin configuration file. It is based on the Rimori Flashcards plugin.
 * It is used to configure the plugin and its pages, sidebar, settings, context menu actions, documentation, and worker.
 */

const config: RimoriPluginConfig = {
  id: "pl1234567890",  // This is the plugin id. You can find it in the plugin's package.json file.
  info: {
    title: "Flashcards",
    description: "The Rimori Flashcards Plugin is a powerful tool for learning and memorization using spaced repetition. It helps you efficiently review information, whether you're learning a language, preparing for exams, or mastering new skills. The plugin uses advanced algorithms to schedule your reviews at optimal intervals, maximizing retention while minimizing study time.",
    logo: "logo.png",
    website: "https://rimori.se",
  },
  pages: {
    main: [
      {
        id: "1",
        url: "#/",
        show: true,
        name: "Flashcards",
        root: "vocabulary",
        description: "Quickly memorizing info by using flashcards."
      },
      { // This is a page that is not shown in the navbar. It is used to trigger the flashcards action.
        id: "2",
        url: "#/deck/custom",
        show: false,
        root: "vocabulary",
        name: "Latest flashcard deck training",
        description: "Training the latest flashcards.",
        action: {
          key: "flashcards",
          parameters: {
            total_amount: {
              type: 'number',
              description: 'Number of flashcards to practice. Default is 70 (10 new + 20 reviewed + 40 forgotten).'
            },
            deck: {
              type: 'string',
              enum: ['latest', 'random', 'oldest', 'mix', 'best_known'],
              description: 'Type of deck to practice from'
            }
          }
        }
      }
    ],
    sidebar: [
      {
        id: "translate",
        url: "#/sidebar/translate",
        name: "Translate",
        icon: "translate.png",
        description: "Translate words."
      },
      {
        id: "flashcard_quick_add",
        url: "#/sidebar/add",
        name: "Quick add",
        icon: "logo.png",
        description: "Quickly add a word to your flashcards."
      }
    ],
    settings: "/settings",
  },
  context_menu_actions: [
    {
      text: "Translate",
      plugin_id: "pl1234567890",
      action_key: "translate"
    },
    {
      text: "Quick add",
      plugin_id: "pl1234567890",
      action_key: "flashcard_quick_add"
    }
  ],
  documentation: {
    overview_path: "docs/overview.md",
    user_path: "docs/user/userdocs.md",
    developer_path: "docs/dev/devdocs.md"
  },
  worker: {
    url: "web-worker.js",
  }
};

export default config;