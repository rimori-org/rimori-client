import { Markdown } from 'tiptap-markdown';
import StarterKit from "@tiptap/starter-kit";
import { PiCodeBlock } from "react-icons/pi";
import { TbBlockquote } from "react-icons/tb";
import { GoListOrdered } from "react-icons/go";
import { AiOutlineUnorderedList } from "react-icons/ai";
import { EditorProvider, useCurrentEditor } from "@tiptap/react";
import { LuHeading1, LuHeading2, LuHeading3 } from "react-icons/lu";
import { FaBold, FaCode, FaItalic, FaParagraph, FaStrikethrough } from "react-icons/fa";

// This inplementation is rooted in the Tiptap editor basic example https://codesandbox.io/p/devbox/editor-9x9dkd

interface EditorButtonProps {
    action: string;
    isActive?: boolean;
    label: string | React.ReactNode;
    disabled?: boolean;
}

const EditorButton = ({ action, isActive, label, disabled }: EditorButtonProps) => {
    const { editor } = useCurrentEditor() as any;

    if (!editor) {
        return null;
    }

    if (action.includes("heading")) {
        const level = parseInt(action[action.length - 1]);
        return (
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: level }).run()}
                className={`pl-2 ${isActive ? "is-active" : ""}`}
            >
                {label}
            </button>
        );
    }

    return (
        <button
            onClick={() => editor.chain().focus()[action]().run()}
            disabled={disabled ? !editor.can().chain().focus()[action]().run() : false}
            className={`pl-2 ${isActive ? "is-active" : ""}`}
        >
            {label}
        </button>
    );
};

const MenuBar = () => {
    const { editor } = useCurrentEditor();

    if (!editor) {
        return null;
    }

    return (
        <div className="bg-gray-400 dark:bg-gray-800 dark:text-white text-lg flex flex-row flex-wrap items-center p-1">
            <EditorButton action="toggleBold" isActive={editor.isActive("bold")} label={<FaBold />} disabled />
            <EditorButton action="toggleItalic" isActive={editor.isActive("italic")} label={<FaItalic />} disabled />
            <EditorButton action="toggleStrike" isActive={editor.isActive("strike")} label={<FaStrikethrough />} disabled />
            <EditorButton action="toggleCode" isActive={editor.isActive("code")} label={<FaCode />} disabled />
            <EditorButton action="setParagraph" isActive={editor.isActive("paragraph")} label={<FaParagraph />} />
            <EditorButton action='setHeading1' isActive={editor.isActive("heading", { level: 1 })} label={<LuHeading1 size={"24px"} />} />
            <EditorButton action='setHeading2' isActive={editor.isActive("heading", { level: 2 })} label={<LuHeading2 size={"24px"} />} />
            <EditorButton action='setHeading3' isActive={editor.isActive("heading", { level: 3 })} label={<LuHeading3 size={"24px"} />} />
            <EditorButton action="toggleBulletList" isActive={editor.isActive("bulletList")} label={<AiOutlineUnorderedList size={"24px"} />} />
            <EditorButton action="toggleOrderedList" isActive={editor.isActive("orderedList")} label={<GoListOrdered size={"24px"} />} />
            <EditorButton action="toggleCodeBlock" isActive={editor.isActive("codeBlock")} label={<PiCodeBlock size={"24px"} />} />
            <EditorButton action="toggleBlockquote" isActive={editor.isActive("blockquote")} label={<TbBlockquote size={"24px"} />} />
        </div>
    );
};

const extensions = [
    StarterKit.configure({
        bulletList: {
            keepMarks: true,
            keepAttributes: false,
        },
        orderedList: {
            keepMarks: true,
            keepAttributes: false,
        },
    }),
    Markdown,
];

interface Props {
    content?: string;
    editable: boolean;
    className?: string;
    onUpdate?: (content: string) => void;
}

export const MarkdownEditor = (props: Props) => {
    return (
        <div className={"text-md border border-gray-800 overflow-hidden " + props.className} style={{ borderWidth: props.editable ? 1 : 0 }}>
            <EditorProvider
                key={(props.editable ? "editable" : "readonly") + props.content}
                slotBefore={props.editable ? <MenuBar /> : null}
                extensions={extensions}
                content={props.content}
                editable={props.editable}
                onUpdate={(e) => {
                    props.onUpdate && props.onUpdate(e.editor.storage.markdown.getMarkdown());
                }}
            ></EditorProvider>
        </div>
    );
};
