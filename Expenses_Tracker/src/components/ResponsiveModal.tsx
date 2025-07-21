import { Fragment, ReactNode } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XIcon } from 'lucide-react';

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

export function ResponsiveModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = ""
}: ResponsiveModalProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'sm:max-w-md';
      case 'lg':
        return 'sm:max-w-2xl';
      case 'xl':
        return 'sm:max-w-4xl';
      case 'full':
        return 'sm:max-w-full sm:m-4';
      default:
        return 'sm:max-w-lg';
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-0 sm:p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-4 sm:translate-y-0"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4 sm:translate-y-0"
            >
              <Dialog.Panel className={`
                w-full 
                max-h-screen 
                sm:max-h-[90vh]
                ${getSizeClasses()}
                transform 
                overflow-hidden 
                rounded-none sm:rounded-2xl 
                bg-white dark:bg-gray-800 
                text-left 
                align-middle 
                shadow-xl 
                transition-all
                ${className}
              `}>
                {/* Header */}
                {title && (
                  <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {title}
                    </Dialog.Title>
                    <button
                      type="button"
                      className="p-2 -mr-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                      onClick={onClose}
                      aria-label="Chiudi modale"
                    >
                      <XIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(100vh-8rem)] sm:max-h-[calc(90vh-8rem)]">
                  {children}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
