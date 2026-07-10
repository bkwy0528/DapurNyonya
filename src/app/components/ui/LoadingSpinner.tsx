export default function LoadingSpinner({ inline = false }: { inline?: boolean }) {
  return (
    <div className={inline ? 'flex justify-center py-12' : 'min-h-screen flex items-center justify-center'}>
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
