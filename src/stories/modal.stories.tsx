import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AlertTriangle } from "@untitledui/icons";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";

const meta = {
    title: "Application/Modal",
    component: Modal,
    tags: ["autodocs"],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => {
        const [isOpen, setIsOpen] = useState(false);
        return (
            <>
                <Button onClick={() => setIsOpen(true)}>Open modal</Button>
                <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
                    <ModalOverlay>
                        <Modal>
                            <Dialog>
                                <div className="w-full max-w-md rounded-2xl bg-primary p-6 shadow-xl">
                                    <h2 className="text-lg font-semibold text-primary">Modal title</h2>
                                    <p className="mt-2 text-sm text-tertiary">
                                        This is a basic modal example with a title and some body content.
                                    </p>
                                </div>
                            </Dialog>
                        </Modal>
                    </ModalOverlay>
                </DialogTrigger>
            </>
        );
    },
};

export const WithActions: Story = {
    render: () => {
        const [isOpen, setIsOpen] = useState(false);
        return (
            <>
                <Button onClick={() => setIsOpen(true)}>Open modal with actions</Button>
                <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
                    <ModalOverlay>
                        <Modal>
                            <Dialog>
                                {({ close }) => (
                                    <div className="w-full max-w-md rounded-2xl bg-primary p-6 shadow-xl">
                                        <h2 className="text-lg font-semibold text-primary">Save changes?</h2>
                                        <p className="mt-2 text-sm text-tertiary">
                                            Your changes will be saved to your account.
                                        </p>
                                        <div className="mt-6 grid grid-cols-2 gap-3">
                                            <Button color="secondary" onClick={close}>
                                                Cancel
                                            </Button>
                                            <Button color="primary" onClick={close}>
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Dialog>
                        </Modal>
                    </ModalOverlay>
                </DialogTrigger>
            </>
        );
    },
};

export const Confirmation: Story = {
    render: () => {
        const [isOpen, setIsOpen] = useState(false);
        return (
            <>
                <Button color="primary-destructive" onClick={() => setIsOpen(true)}>
                    Delete account
                </Button>
                <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
                    <ModalOverlay>
                        <Modal>
                            <Dialog>
                                {({ close }) => (
                                    <div className="w-full max-w-md rounded-2xl bg-primary p-6 shadow-xl">
                                        <FeaturedIcon icon={AlertTriangle} color="error" theme="light" size="lg" />
                                        <h2 className="mt-4 text-lg font-semibold text-primary">Delete account</h2>
                                        <p className="mt-2 text-sm text-tertiary">
                                            Are you sure you want to delete your account? This action cannot be undone.
                                        </p>
                                        <div className="mt-6 grid grid-cols-2 gap-3">
                                            <Button color="secondary" onClick={close}>
                                                Cancel
                                            </Button>
                                            <Button color="primary-destructive" onClick={close}>
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Dialog>
                        </Modal>
                    </ModalOverlay>
                </DialogTrigger>
            </>
        );
    },
};
