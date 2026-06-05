/**
 * EventGroupController — thin bridge from Express to handler functions.
 */
import { Request, Response } from 'express';
import addEventGroup from './addEventGroup';
import bulkDeleteEventGroup from './bulkDeleteEventGroup';
import deleteEventGroup from './deleteEventGroup';
import getEventGroup from './getEventGroup';
import listEventGroup from './listEventGroup';
import updateEventGroup from './updateEventGroup';

class EventGroupController {
  public add = async (req: Request, res: Response) => {
    addEventGroup(req, res);
  };
  public get = async (req: Request, res: Response) => {
    getEventGroup(req, res);
  };
  public update = async (req: Request, res: Response) => {
    updateEventGroup(req, res);
  };
  public delete = async (req: Request, res: Response) => {
    deleteEventGroup(req, res);
  };
  public deleteBulk = async (req: Request, res: Response) => {
    bulkDeleteEventGroup(req, res);
  };
  public list = async (req: Request, res: Response) => {
    listEventGroup(req, res);
  };
}

export default EventGroupController;
