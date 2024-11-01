import { Router, Response, Request } from "express";
import { ProjectModel } from "../models/project";
import multer from "multer";
import mongoose from "mongoose";
import { Readable } from "stream";
import { authenticateToken } from "../middleware/authenticateToken";
import path from "path";
import { ReimbursementModel } from "../models/reimburse";
import puppeteer from "puppeteer";

const router: Router = Router();
const conn = mongoose.connection;
let gfs: mongoose.mongo.GridFSBucket;

router.use(authenticateToken);

// Initialize GridFS when MongoDB connection is open
conn.once("open", () => {
    gfs = new mongoose.mongo.GridFSBucket(conn.db!, {
        bucketName: "uploads"
    });
});

// Set up Multer storage for GridFS
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Function to get a sanction letter file and return its path
const getSanctionLetterFilePath = (fileId: mongoose.Types.ObjectId): string => {
    return path.join(__dirname, `../uploads/${fileId}`); // Adjust the path as needed
};

// Route to get the total sum of all project amounts
router.get('/grandtotal', async (req: Request, res: Response) => {
    try {
        const result = await ProjectModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalSum: { $sum: "$total_amount" }
                }
            }
        ]);

        const totalAmountSum = result.length > 0 ? result[0].totalSum : 0;
        res.json({ total_amount_sum: totalAmountSum });
    } catch (error) {
        res.status(500).json({ message: 'Error calculating total sum', error });
    }
});

// Route to create a new project and upload sanction letter
router.post('/', upload.single('sanction_letter'), async (req: Request, res: Response) => {
    try {
        const { project_name, start_date, end_date, project_heads, total_amount, pis, copis } = req.body;

        const startDate = start_date ? new Date(start_date) : null;
        const endDate = end_date ? new Date(end_date) : null;
        const projectHeads = JSON.parse(project_heads) as number[];

        let sanctionLetterFileId: mongoose.Types.ObjectId | null = null;

        // Handle file upload if provided
        if (req.file) {
            const readableStream = new Readable();
            readableStream.push(req.file.buffer);
            readableStream.push(null);

            const uploadStream = gfs.openUploadStream(req.file.originalname, {
                contentType: req.file.mimetype || 'application/octet-stream'
            });

            await new Promise<void>((resolve, reject) => {
                readableStream.pipe(uploadStream)
                    .on("error", (err) => reject(err))
                    .on("finish", () => {
                        sanctionLetterFileId = uploadStream.id; // Save the file ID
                        resolve();
                    });
            });
        }

        // Create and save new project
        const newProject = new ProjectModel({
            project_name,
            start_date: startDate,
            end_date: endDate,
            project_heads: projectHeads,
            total_amount: Number(total_amount),
            pis: JSON.parse(pis),
            copis: JSON.parse(copis),
            sanction_letter_file_id: sanctionLetterFileId
        });

        const savedProject = await newProject.save();
        res.status(201).json(savedProject);
    } catch (error) {
        res.status(500).json({ message: 'Error creating project', error: (error as Error).message });
    }
});

// Route to get all projects without sanction letter files
router.get('/', async (req: Request, res: Response) => {

    const all = (req.query.all as string) == "true"

    if (all){
        try {
            const projects = await ProjectModel.find()
            res.status(200).json(projects);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching projects', error });
        }
        finally{
            return
        }
    }

    const page = parseInt(req.query.page as string) || 1; // Default to page 1
    const limit = 4; // Limit of 6 expenses per page
    const skip = (page - 1) * limit;

    try {
        const projects = await ProjectModel.find()
            .skip(skip)
            .limit(limit);

        const totalProjects = await ProjectModel.countDocuments(); // Total count of expenses
        const totalPages = Math.ceil(totalProjects / limit);

        res.status(200).json({
            projects,
            pagination: {
                currentPage: page,
                totalPages,
                totalProjects,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error });
    }
});

// Route to get a single project by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const project = await ProjectModel.findById(req.params.id);

        if (!project) {
            res.status(404).json({ message: 'Project not found' });
            return;
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching project', error });
    }
});

// Route to get the sanction letter by project ID
router.get('/:id/sanction_letter', async (req: Request, res: Response) => {
    try {
        const project = await ProjectModel.findById(req.params.id);

        if (!project) {
            console.error(`Project not found for ID: ${req.params.id}`);
            res.status(404).json({ message: 'Project not found' });
            return;
        }

        if (!project.sanction_letter_file_id) {
            console.error(`No sanction letter found for project ID: ${req.params.id}`);
            res.status(404).json({ message: 'Sanction letter not found for this project' });
            return;
        }

        const fileId = project.sanction_letter_file_id;

        // Create a download stream from GridFS
        const downloadStream = gfs.openDownloadStream(fileId);

        // Set the correct headers for the file download
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `inline; filename=${fileId}`);

        // Handle potential errors while streaming the file
        downloadStream.on('error', (error) => {
            console.error(`Error fetching file: ${error.message}`);
            res.status(404).send('File not found');
            return;
        });

        // Pipe the download stream to the response
        downloadStream.pipe(res).on('finish', () => {
            console.log('File streamed successfully.');
        });

        return;
    } catch (error) {
        console.error(`Error fetching sanction letter for project ID ${req.params.id}: ${(error as Error).message}`);
        res.status(500).json({ message: 'Error fetching sanction letter', error: (error as Error).message });
        return;
    }
});

router.get('/:id/util_cert', async (req, res) => {
    try {
        const projectId = req.params.id;

        // 1. Fetch the project by its ID
        const project = await ProjectModel.findById(projectId);
        if (!project) {
            res.status(404).send('Project not found');
            return;
        }

        // 2. Find all reimbursements related to this project
        const reimbursements = await ReimbursementModel.find({ project: projectId });

        // Initialize a map to track expenses per project head
        const expenseSummary = new Map();

        // 3. Calculate total expenses per project head
        reimbursements.forEach((reimbursement) => {
            const head = reimbursement.projectHead;
            const totalAmount = reimbursement.totalAmount;

            // Sum up the expenses per head
            if (expenseSummary.has(head)) {
                expenseSummary.set(head, expenseSummary.get(head) + totalAmount);
            } else {
                expenseSummary.set(head, totalAmount);
            }
        });

        // 4. Generate HTML for the utilization certificate
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Utilization Certificate</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 10px 20px; }
                .header { display: flex; justify-content: space-between; align-items: center; padding}
                .company-info { text-align: center; margin: 20px 0; } /* Center text and add margin */
                .header img { max-width: 100px; height: auto; }
                h1 { text-align: center;}
                h2 { text-decoration: underline; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 8px; text-align: left; border: 1px solid #ccc; }
                th { background-color: #f2f2f2; }
                tfoot { font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="${req.protocol}://${req.get('host')}/logo.jpg" alt="LAMBDA Logo" /> <!-- Logo on the left -->
                <div class="company-info">
                    <h1>LAMBDA Lab</h1> <!-- Company Name -->
                    <i>BITS Pilani, Hyderabad Campus</i> <!-- Place -->
                </div>
                <img src="${req.protocol}://${req.get('host')}/bitslogo.png" alt="BITS Pilani Logo" /> <!-- Logo on the right -->
            </div>
            <h2>Utilization Certificate</h2>
            <h3>Project Details</h3>
            <p><strong>Project Name:</strong> ${project.project_name}</p>
            <p><strong>Start Date:</strong> ${project.start_date ? project.start_date.toDateString() : 'N/A'}</p>
            <p><strong>End Date:</strong> ${project.end_date ? project.end_date.toDateString() : 'N/A'}</p>
            <p><strong>Total Allocated Amount:</strong> Rs. ${project.total_amount}</p>

            <h3>Project Head Details</h3>
            <table>
                <thead>
                    <tr>
                        <th>Head</th>
                        <th>Allocated Amount</th>
                        <th>Expenses</th>
                        <th>Remaining</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(project.project_heads).map(([head, amounts]) => {
            const totalAllocated = amounts.reduce((sum, amount) => sum + amount, 0);
            const expenses = expenseSummary.get(head) || 0;
            const remaining = totalAllocated - expenses;

            return `
                        <tr>
                            <td>${head}</td>
                            <td>Rs. ${totalAllocated}</td>
                            <td>Rs. ${expenses}</td>
                            <td>Rs. ${remaining}</td>
                        </tr>`;
        }).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td>Total</td>
                        <td>Rs. ${Array.from(project.project_heads).reduce((sum, [head, amounts]) => sum + amounts.reduce((a, b) => a + b, 0), 0)}</td>
                        <td>Rs. ${Array.from(expenseSummary.values()).reduce((sum, val) => sum + val, 0)}</td>
                        <td>Rs. ${Array.from(project.project_heads).reduce((sum, [head, amounts]) => sum + amounts.reduce((a, b) => a + b, 0), 0) - Array.from(expenseSummary.values()).reduce((sum, val) => sum + val, 0)}</td>
                    </tr>
                </tfoot>
            </table>
            <p style="text-align: right;">Generated on: ${new Date().toLocaleDateString()}</p>
        </body>
        </html>`;

        // 5. Launch Puppeteer to generate PDF
        const browser = await puppeteer.launch({ headless: false })
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'networkidle0' })
        const pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', timeout: 0 }))
        await browser.close()
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Utilization_Certificate_${project.project_name}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('An error occurred while generating the PDF');
    }
});

// Route to update a project by ID
router.put('/projects/:id', async (req: Request, res: Response) => {
    try {
        const { project_name, start_date, end_date, project_heads, total_amount, pis, copis } = req.body;

        const updatedProject = await ProjectModel.findByIdAndUpdate(
            req.params.id,
            { project_name, start_date, end_date, project_heads, total_amount, pis, copis },
            { new: true }
        );

        if (!updatedProject) {
            res.status(404).json({ message: 'Project not found' });
        } else {
            res.json(updatedProject);
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating project', error });
    }
});

// Route to delete a project by ID
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const deletedProject = await ProjectModel.findByIdAndDelete(req.params.id);
        if (!deletedProject) {
            res.status(404).json({ message: 'Project not found' });
        } else {
            res.status(204).send();  // No Content
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting project', error });
    }
});

export default router;