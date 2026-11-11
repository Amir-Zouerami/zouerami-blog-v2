import { fileUrl } from './api';
import { useToast } from './ui';

interface Props {
  /** Record the images belong to; null before the first save. */
  postId: string | null;
  images: string[];
  onRemove: (filename: string) => void;
}

/** The post's uploaded images with copy-markdown and remove actions. */
export default function ImageLibrary({ postId, images, onRemove }: Props) {
  const toast = useToast();
  return (
    <section className="adm-images">
      <h3 className="mono muted">Images {postId ? `(${images.length})` : ''}</h3>
      {!postId && (
        <p className="muted">
          Save the post once to enable image uploads. You can also paste or drop images straight
          into the editor.
        </p>
      )}
      <div className="adm-imgs">
        {postId &&
          images.map((name) => (
            <figure key={name}>
              <img
                src={fileUrl('posts', postId, name, name.endsWith('.svg') ? undefined : '480x0')}
                alt=""
                loading="lazy"
              />
              <figcaption className="mono">{name}</figcaption>
              <div className="row-inline">
                <button
                  type="button"
                  className="adm-btn"
                  onClick={() => {
                    void navigator.clipboard.writeText(`![](img:${name})`);
                    toast('Markdown copied');
                  }}
                >
                  Copy markdown
                </button>
                <button
                  type="button"
                  className="adm-btn danger"
                  onClick={() => {
                    if (confirm('Remove this image? Posts that use it will show a broken image.'))
                      onRemove(name);
                  }}
                >
                  Remove
                </button>
              </div>
            </figure>
          ))}
      </div>
    </section>
  );
}
