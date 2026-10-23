import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { CsvError, readCsvFile } from '../lib/csv';
import { useRouteStore } from '../store/routeStore';

export function CsvImport() {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const addStops = useRouteStore((s) => s.addStops);

  const handle = async (file?: File) => {
    if (!file) return;
    try {
      const addresses = await readCsvFile(file);
      const n = addStops(addresses);
      if (n) toast.success(`${n} adresse${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}`);
    } catch (e) {
      toast.error(e instanceof CsvError ? e.message : 'Impossible de lire le fichier');
    }
    if (input.current) input.current.value = '';
  };

  return (
    <button
      type="button"
      title="Un fichier .csv avec une adresse par ligne (lignes # ignorées)"
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files[0]); }}
      className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-2.5 text-sm ${over ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
    >
      <Upload className="h-4 w-4" /> Importer un CSV
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
    </button>
  );
}
