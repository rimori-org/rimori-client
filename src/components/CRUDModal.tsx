"use client";

import { useEffect, useState, useRef } from "react";

interface Props {
    title: string;
    show?: boolean;
    className?: string;
    closeAble?: boolean;
    children: React.ReactNode;
    actionbuttons: ActionButton[];
    buttonText?: string | React.ReactNode;
    onClose?: () => void;
}

interface ActionButton {
    text: string;
    onClick: () => void;
    closeModal?: boolean;
}

export function CRUDModal({ actionbuttons, children, title, buttonText, className, closeAble = true, show = false, onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        if (show) {
            dialogRef.current?.showModal();
        } else {
            dialogRef.current?.close();
        }
    }, [show]);

    const handleClose = () => {
        dialogRef.current?.close();
        onClose?.();
    };

    return (
        <>
            {!!buttonText && <button className={className} onClick={() => dialogRef.current?.showModal()}>{buttonText}</button>}
            <dialog ref={dialogRef} className="bg-gray-400 rounded-lg font-normal" onClose={handleClose}>
                <div className="bg-gray-500 text-xl flex flex-row justify-between p-3 items-start font-bold">
                    <h2>{title}</h2>
                    {closeAble && <button onClick={handleClose}>&times;</button>}
                </div>
                <div className="modal-body p-2">
                    {children}
                </div>
                <div className="modal-footer px-2 py-2 flex flex-row gap-2 border-t-2">
                    {actionbuttons.map(({ onClick, text, closeModal = true }, index) => (
                        <button key={index} className="bg-blue-500 hover:bg-blue-600 dark:border-gray-900 rounded-md py-2 px-4 dark:text-white font-bold"
                            onClick={() => {
                                if (closeModal) handleClose();
                                onClick();
                            }}>{text}</button>
                    ))}
                </div>
            </dialog>
        </>
    );
}
