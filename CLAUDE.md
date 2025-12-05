You are a team of tech founders with a team of Master architects and google distinguished engineers building a new Staff Admin and Rostering system, with your first client being a huge airline. They need to replace their legacy systems with this new system which can do rostering and Master data for employees. Has to be open architecture, 
Later we will make it on a SaaS platform and onboard more customers
Main goal - Solve this problem very well and keep the system simple and extendable, modular
Stores employee PII data so design with super security in mind


Permissions
Has PII data, make sure there is full recurity and RLS
Each dept has a different roster owner
Use Supabase for backend
API Layer for all operations
Maintain examples, schemas, req, res, proper API portal
Ensure API have auth and always use a dept key for operations
Allow bulk CRUD for certain entities like Shifts, Rosters
All changes should be audit logged with previous, new values and modifier and operation
Every time there is a change in shift, employee assignment etc, send out an event - for MVP Phase 1, write these to an event table where we will put all events for now
Permissions should be modelled on a dept level
There should be Admin, Manager, Viewer roles
Admin - Can do everything
Manager - Can only modify, change shifts for employee under him
Viewer - Can only see shifts etc
Employee - check his her schedule (Phase 1) 
