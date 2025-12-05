Employee

Store Emp infor, full details including joining date etc, Every employee belongs to an OpCo and a Department
IAG -> BA -> Engineering, Ground Operations, Passenger Services …-> Check In
Link Emp to qualifications 
Check expiry of qualifications
Employee mapped to role

Employee Anomaly
Link to employee
Condition like injury, pregnancy etc
Expiry
Timelines 
Restrictions - which roles they can perform or not
Comments - Further detail for planner / resources

Department
Department details
Role (enum defined list)
Role mapped to qualifications (as necessary to perform role)
Role Minimum Skills - Must have to fulfil a role (Used when shortage of labour)
Role Recommended Skills - Ideal to perform the role optimally

Contract
Contract has t&c
Contract has types - make it enum - Full time, part time etc
How many working hours 
Limits
Link Contract to Employee
Employee cannot be active for rostering without an active Contract - if contact ends, employee is inactive for all means

Qualifications
Master qualifications - list
Details of qualifications
Expirty based on relevance further details
Could have more columns etc

Qual - Emp Link
Qualification expiry
Qualification conditions - eg. in first six months you can't have more than X qualifications
Employee has mapping to attained qualifications and expiry of that


Shifts
Planning system sends shift info


Shift Requirements
Timings, Date (Shift pattern)
How many people
What department, Sub dept
Which locations
What employee role is needed
Ideal case
Sub optimal case (minimum role qualifications)

Rostering - How do we build this engine, map optimally, forecast if resources not enough, when do we run out, do we need to hire temp staff…
Based on shift required for day, assign staff to shifts
Before assignment check skills, conditions, limits, working hours, absenses etc
Before assignment check temp employee issues (Anomalies) - like pregnant, backpain, injury conditions etc

Absenses
Employee can call sick - Update roster based on changes by employee
EMployee can book leave
Employee can swap shift with another employee
Employee can bid for a leave during holiday season
Retrospective update from Allocator - citing employee unavailable (via API call / ATR integration) - mark employee absent with timings - post shift start + 30 mins) - Phase 2

Forecast
Be able to plan up to day of ops - 30 days
Get a view of day, day -3, day -7 etc
Be able to forecast the utilization for employee & shift





Tech

All operations should be done via APIs
System should have APIs to support every operation
Keep things very simple, modular and extendable

Auth
We need to manage keys for API Authentication which we can rotate till we have a client provider
We need to manage User auth - employees where till we get an IDP we use the DB as a auth management solution
User should only have access to their record - to only be able to view details and request for absence (Phase 2)

Permissions

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
Can bid for holiday, raise absence, ask for swap, (Phase 2)
