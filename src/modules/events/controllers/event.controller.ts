import { Request, Response } from 'express';
import getEvent from './getEvent';
import listEvent from './listEvent';

class EventController {
  public list = async (req: Request, res: Response) => {
    listEvent(req, res);
  };
  public get = async (req: Request, res: Response) => {
    getEvent(req, res);
  };
}

export default EventController;
