export default function FormModal({ titulo, onClose, onSubmit, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold text-slate-100">{titulo}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {children}
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
