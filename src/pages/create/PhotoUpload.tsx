import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Camera, AlertCircle, ArrowRight } from 'lucide-react';
import { useWizard } from '../../context/WizardContext';

export function PhotoUpload() {
  const { data, updateData } = useWizard();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const totalFiles = [...data.photos, ...newFiles].slice(0, 3);
    const previewUrls = totalFiles.map(f => URL.createObjectURL(f));

    data.photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    updateData({ photos: totalFiles, photoPreviewUrls: previewUrls });
  }, [data.photos, data.photoPreviewUrls, updateData]);

  function removePhoto(index: number) {
    const newPhotos = data.photos.filter((_, i) => i !== index);
    URL.revokeObjectURL(data.photoPreviewUrls[index]);
    const newPreviews = data.photoPreviewUrls.filter((_, i) => i !== index);
    updateData({ photos: newPhotos, photoPreviewUrls: newPreviews });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleNext() {
    if (data.photos.length > 0) {
      navigate('/create/profile');
    }
  }

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 mb-4">
          <Camera className="w-8 h-8 text-brand-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-gray-900 mb-3">
          Upload Photos of Your Child
        </h1>
        <p className="text-lg text-gray-600 max-w-lg mx-auto">
          Upload 1-3 clear photos. These help us create illustrations that look like your child in the story.
        </p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-200 ${
          dragActive
            ? 'border-brand-500 bg-brand-50'
            : 'border-gray-300 hover:border-brand-400 hover:bg-sand-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={e => handleFiles(e.target.files)}
        />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-1">
          Drag & drop photos here
        </p>
        <p className="text-sm text-gray-500">
          or click to browse (PNG, JPG up to 10MB each)
        </p>
      </div>

      {data.photoPreviewUrls.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          {data.photoPreviewUrls.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden shadow-md group">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 p-4 bg-ocean-50 rounded-xl border border-ocean-200">
        <AlertCircle className="w-5 h-5 text-ocean-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-ocean-800">Tips for best results</p>
          <ul className="text-sm text-ocean-700 mt-1 space-y-0.5">
            <li>Use well-lit, front-facing photos</li>
            <li>Clear shots of the face work best</li>
            <li>Avoid group photos or heavy filters</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleNext}
          disabled={data.photos.length === 0}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          Next: Child's Profile
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
}
