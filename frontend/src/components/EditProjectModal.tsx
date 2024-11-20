import { Button, Modal, Label, TextInput, Checkbox } from 'flowbite-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Project, Member } from "../types";  // Ensure Member type is correctly imported
import { useEffect, useState } from 'react';
import { toastError } from '../toasts';

interface EditProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project | null;
    onSave: (updatedProject: Project) => void;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose, project, onSave }) => {
    const { register, handleSubmit, watch, setValue, reset, control } = useForm<Project>({
        defaultValues: {
            project_name: project?.project_name || '',
            total_amount: project?.total_amount || 0,
            project_heads: project?.project_heads || {},
            pis: project?.pis || [],  // Keep this as array of Member objects
            copis: project?.copis || [],  // Same for co-pis
            negative_heads: project?.negative_heads || [],
            project_id: project?.project_id || '',  // Add project_id
            project_title: project?.project_title || ''  // Add project_title
        }
    });

    const { fields: pisFields, append: appendPi, remove: removePi } = useFieldArray({
        control,
        name: 'pis'
    });

    const { fields: copisFields, append: appendCopi, remove: removeCopi } = useFieldArray({
        control,
        name: 'copis'
    });

    const [faculties, setFaculties] = useState<Array<Member>>([]);
    const [selectedPi, setSelectedPi] = useState<string | null>(null);  // Track selected PI for button click
    const [selectedCopi, setSelectedCopi] = useState<string | null>(null); // Track selected Co-PI for button click

    const fetchFaculties = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/member?type=faculty`, {
                credentials: 'include',
            });
            const data = await response.json();
            setFaculties(data);
        } catch (error) {
            toastError('Error fetching members');
            console.error('Error fetching members:', error);
        }
    };

    useEffect(() => {
        if (project) {
            reset(project);
        }
        fetchFaculties();
    }, [project, reset]);

    const onSubmit = (submittedProject: Project) => {
        const updatedProject = submittedProject; // `pis` and `copis` are already Member objects

        onSave(updatedProject);
        onClose();
    };

    // Handle Add PI button click
    const handleAddPi = () => {
        const selectedPiMember = faculties.find(faculty => faculty._id === selectedPi);
        if (selectedPiMember) {
            appendPi(selectedPiMember);
            setSelectedPi(null);  // Reset selection after adding
        }
    };

    // Handle Add Co-PI button click
    const handleAddCopi = () => {
        const selectedCoPiMember = faculties.find(faculty => faculty._id === selectedCopi);
        if (selectedCoPiMember) {
            appendCopi(selectedCoPiMember);
            setSelectedCopi(null);  // Reset selection after adding
        }
    };

    return (
        <Modal show={isOpen} onClose={onClose} size="4xl">
            <Modal.Header>
                <h2 className="text-lg font-semibold">Edit Project</h2>
            </Modal.Header>
            <Modal.Body>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                        {/* Project ID Field */}
                        <div>
                            <Label htmlFor="projectId" value="Project ID" />
                            <TextInput
                                id="projectId"
                                {...register("project_id", { required: true })}
                                placeholder="Enter project ID"
                                className="mt-1"
                            />
                        </div>

                        {/* Project Title Field */}
                        <div>
                            <Label htmlFor="projectTitle" value="Project Title" />
                            <TextInput
                                id="projectTitle"
                                {...register("project_title", { required: true })}
                                placeholder="Enter project title"
                                className="mt-1"
                            />
                        </div>

                        {/* Project Name Field */}
                        <div>
                            <Label htmlFor="projectName" value="Project Name" />
                            <TextInput
                                id="projectName"
                                {...register("project_name", { required: true })}
                                placeholder="Enter project name"
                                className="mt-1"
                            />
                        </div>

                        {/* Total Amount Field */}
                        <div>
                            <Label htmlFor="totalAmount" value="Total Amount" />
                            <TextInput
                                id="totalAmount"
                                type="number"
                                {...register("total_amount", { required: true, valueAsNumber: true })}
                                placeholder="Enter total amount"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                        <h3 className="text-md font-medium text-gray-700">Project Heads</h3>
                        {Object.entries(project?.project_heads || {}).map(([headName, amounts], index) => (
                            <div key={index} className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Label value={headName} className="text-sm font-semibold text-gray-600" />
                                    <Checkbox
                                        id={`${headName}_neg_checkbox`}
                                        checked={watch('negative_heads')?.includes(headName)}
                                        onChange={() => {
                                            if (watch('negative_heads')?.includes(headName)) {
                                                setValue('negative_heads', watch('negative_heads')?.filter(negativeHead => negativeHead !== headName));
                                            } else {
                                                setValue('negative_heads', [...watch('negative_heads'), headName]);
                                            }
                                        }}
                                    />
                                    <Label value="Allow Negative Values" htmlFor={`${headName}_neg_checkbox`} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {amounts.map((amount, i) => (
                                        <TextInput
                                            key={i}
                                            type="number"
                                            defaultValue={amount}
                                            {...register(`project_heads.${headName}.${i}`, { valueAsNumber: true })}
                                            placeholder={`Installment ${i + 1}`}
                                            className="mt-1"
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t pt-4 space-y-4">
                        <h3 className="text-md font-medium text-gray-700">Principal Investigators (PIs)</h3>
                        <div className="flex justify-between">
                            <div>
                                <Label htmlFor="pi" value="Add Principal Investigators (PIs)" />
                                <div className="flex items-center space-x-3">
                                    <select
                                        id="pi"
                                        value={selectedPi || ''}
                                        onChange={(e) => setSelectedPi(e.target.value)}
                                        className="border p-2 rounded"
                                    >
                                        <option value="">Select PI</option>
                                        {faculties.map((faculty) => (
                                            <option value={faculty._id} key={faculty._id}>
                                                {faculty.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button onClick={handleAddPi} color="blue" disabled={!selectedPi} size="sm">
                                        Add PI
                                    </Button>
                                </div>
                                {pisFields.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-bold">PIs:</h4>
                                        <ul>
                                            {pisFields.map((pi, idx) => (
                                                <li key={pi.id} className="flex justify-between">
                                                    <span>{pi.name}</span>
                                                    <Button
                                                        color="blue"
                                                        onClick={() => removePi(idx)}
                                                        type="button"
                                                        size="xs"
                                                    >
                                                        Delete
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label value="Add Co-Principal Investigators (Co-PIs)" />
                                <div className="flex items-center space-x-3">
                                    <select
                                        value={selectedCopi || ''}
                                        onChange={(e) => setSelectedCopi(e.target.value)}
                                        className="border p-2 rounded"
                                    >
                                        <option value="">Select Co-PI</option>
                                        {faculties.map((faculty) => (
                                            <option value={faculty._id} key={faculty._id}>
                                                {faculty.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Button onClick={handleAddCopi} color="blue" disabled={!selectedCopi} size="sm">
                                        Add Co-PI
                                    </Button>
                                </div>
                                {copisFields.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-bold">Co-PIs:</h4>
                                        <ul>
                                            {copisFields.map((copi, idx) => (
                                                <li key={copi.id} className="flex justify-between">
                                                    <span>{copi.name}</span>
                                                    <Button
                                                        color="blue"
                                                        onClick={() => removeCopi(idx)}
                                                        type="button"
                                                        size="xs"
                                                    >
                                                        Delete
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={onClose} color="gray">
                    Cancel
                </Button>
                <Button type="submit" onClick={handleSubmit(onSubmit)} className="bg-blue-600 hover:bg-blue-700">
                    Save Changes
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EditProjectModal;