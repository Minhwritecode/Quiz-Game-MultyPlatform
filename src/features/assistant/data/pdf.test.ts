import * as DocumentPicker from 'expo-document-picker';
import { pickPdf } from './pdf';
jest.mock('expo-document-picker',()=>({getDocumentAsync:jest.fn()}));
it('returns null after cancellation',async()=>{
 (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({canceled:true});
 expect(await pickPdf()).toBeNull();
});
it('rejects oversized PDFs before reading bytes',async()=>{
 (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({canceled:false,assets:[{size:5*1024*1024,name:'large.pdf'}]});
 await expect(pickPdf()).rejects.toThrow('4 MB');
});
