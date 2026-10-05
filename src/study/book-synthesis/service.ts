import { BOOK_BY_ID } from '../../domain/references/books.js';
import type { SelahRepository } from '../../persistence/types.js';
import type { BookSynthesis } from './types.js';

export class BookSynthesisService {
  constructor(private readonly repository: SelahRepository) {}

  async get(bookId:string):Promise<BookSynthesis|undefined>{
    if(!BOOK_BY_ID.has(bookId))throw new Error(`Unknown Bible book: ${bookId}`);
    return this.repository.getBookSynthesis(bookId);
  }

  async save(bookId:string,understanding:string,now=Date.now()):Promise<BookSynthesis>{
    if(!BOOK_BY_ID.has(bookId))throw new Error(`Unknown Bible book: ${bookId}`);
    if(understanding.length>12_000)throw new Error('Book understanding must be 12,000 characters or fewer');
    const value={bookId,understanding,updatedAt:now};
    await this.repository.putBookSynthesis(value);
    return value;
  }
}
