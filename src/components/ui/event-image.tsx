
interface EventImageProps {
  src: string;
  alt?: string;
  className?: string;
}

export function EventImage({ src, alt, className }: EventImageProps) {
  const fallbackImage = '/placeholder.svg';
  
  return (
    <div className={`event-image-wrapper ${className || ''}`}>
      <img 
        src={src || fallbackImage} 
        alt={alt || 'Image d\'événement'} 
        className="event-image"
        loading="lazy"
      />
    </div>
  );
}
