import { X, Image } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ImageAttachment } from '../types'

interface ImagePillsProps {
  images: ImageAttachment[]
  onRemove: (index: number) => void
}

export default function ImagePills({ images, onRemove }: ImagePillsProps) {
  if (images.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {images.map((image, index) => (
          <motion.div
            key={`${image.name}-${index}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="relative group"
          >
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 border border-gray-200 text-sm">
              <Image className="w-4 h-4 text-gray-700" />
              <span className="text-gray-900 max-w-[150px] truncate">{image.name}</span>
              <button
                onClick={() => onRemove(index)}
                className="ml-1 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3 text-gray-700" />
              </button>
            </div>
            {/* Image preview on hover */}
            <div className="absolute left-0 bottom-full mb-2 p-1 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <img 
                src={image.data} 
                alt={image.name} 
                className="max-w-[200px] max-h-[150px] object-contain rounded"
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}