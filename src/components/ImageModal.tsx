import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import ReactDOM from "react-dom"; // Add this import

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt: string;
}

const ImageModal = ({ isOpen, onClose, imageUrl, alt }: ImageModalProps) => {
  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          {/* Rest of the modal content remains the same */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-[90vw] max-h-[90vh]"
          >
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <motion.img
              src={imageUrl}
              alt={alt}
              className="w-full h-[90vh] object-cover rounded-lg"
              layoutId="main-image"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body // Portal to body element
  );
};

export default ImageModal;
